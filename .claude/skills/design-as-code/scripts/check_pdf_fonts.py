# -*- coding: utf-8 -*-
"""Contrôle qu'un PDF est lisible PARTOUT (pas seulement sur la machine qui l'a produit).

Usage : python check_pdf_fonts.py <fichier.pdf | "motif/*.pdf"> [...]
        (les motifs * sont expansés PAR LE SCRIPT : PowerShell/cmd ne le font pas)
Codes retour : 0 = tous sûrs · 1 = au moins un PDF à risque · 2 = fichier(s) introuvable(s)

POURQUOI CE SCRIPT (incident du 21/07/2026, oral MJM) :
le dossier ouvert sur le PC du jury affichait le texte en « points façon braille »
+ un message de police manquante. Cause : des graisses demandées par le CSS sans vrai
fichier (mapping menteur, faux gras sur police mono-graisse, police variable). Le moteur
SYNTHÉTISE alors le rendu et le rastérise en polices **Type3** (glyphes dessinés, sans
table de caractères) -> illisible sur un autre lecteur, invisible sur le poste de prod.

Règle : un PDF de rendu ne doit contenir NI Type3, NI police non embarquée.

Note lecture : les noms internes Fontsource peuvent être trompeurs
(ex. « MontserratThin-SemiBold » = le SemiBold correct : seul le SUFFIXE et le rendu
PNG font foi, pas le « Thin » du milieu).
"""
import sys
from pathlib import Path

import fitz  # PyMuPDF

# Polices système : leur présence signale SOIT un choix volontaire, SOIT une webfont
# qui n'a pas chargé (href cassé, graisse absente, glyphe hors subset).
SYSTEM_HINTS = ("SegoeUI", "Arial", "TimesNewRoman", "MS-PGothic",
                "Calibri", "Cambria", "CourierNew", "Consolas", "Helvetica")
# Les 14 polices PDF standard n'ont pas besoin d'être embarquées
BASE14 = ("Helvetica", "Courier", "Times", "Symbol", "ZapfDingbats")


def check(pdf: Path):
    doc = fitz.open(pdf)
    type3, not_embedded, system, ok = {}, {}, {}, set()
    for pno, page in enumerate(doc, 1):
        for xref, ext, ftype, basefont, name, enc in [f[:6] for f in page.get_fonts(full=True)]:
            if ftype == "Type3":
                type3.setdefault(basefont or "(sans nom)", []).append(pno)
            elif xref == 0 or ext in ("n/a", ""):
                if not any(b in basefont for b in BASE14):
                    not_embedded.setdefault(basefont, []).append(pno)
            else:
                ok.add(basefont)
                if any(h in basefont.replace(" ", "") for h in SYSTEM_HINTS):
                    system.setdefault(basefont, []).append(pno)
    n = len(doc)
    doc.close()

    print(f"\n=== {pdf.name} ({n} p.) ===")
    fail = False
    if type3:
        fail = True
        print(f"  [ECHEC] {len(type3)} police(s) Type3 = texte rastérisé -> « braille » ailleurs")
        for f, pages in list(type3.items())[:6]:
            print(f"          {f}  (p. {pages[0]}...{pages[-1]}, {len(pages)} pages)")
        print("          FIX : vraie graisse statique (fetch_fonts.py), font-weight:400 sur les")
        print("          mono-graisses, JAMAIS de police variable ni de text-shadow sur du texte.")
    if not_embedded:
        fail = True
        print(f"  [ECHEC] {len(not_embedded)} police(s) NON embarquée(s) :")
        for f, pages in list(not_embedded.items())[:6]:
            print(f"          {f}  (p. {pages[0]}...)")
    if system:
        print("  [ALERTE] police(s) système embarquée(s) — OK si c'est un choix volontaire ;")
        print("           sinon une webfont n'a pas chargé (href cassé ? graisse absente ?")
        print("           glyphe hors subset ?) et Chrome a replié en silence :")
        for f, pages in list(system.items())[:6]:
            print(f"          {f}  (p. {pages[0]}...)")
    if not fail and not system:
        print(f"  [OK] {len(ok)} police(s), toutes embarquées, aucun Type3.")
    for f in sorted(ok):
        print(f"        - {f}")
    return fail


def expand(args):
    """Expanse les motifs * nous-mêmes : PowerShell/cmd ne le font pas."""
    out = []
    for a in args:
        if "*" in a or "?" in a:
            p = Path(a)
            base = p.parent if str(p.parent) not in ("", ".") else Path(".")
            found = sorted(base.glob(p.name))
            if not found:
                print(f"[?] aucun fichier ne correspond au motif : {a}")
            out.extend(found)
        else:
            out.append(Path(a))
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(2)
    files = expand(args)
    bad, notfound, checked = False, False, 0
    for p in files:
        if not p.exists():
            print(f"[?] introuvable : {p}")
            notfound = True
            continue
        bad |= check(p)
        checked += 1
    if not checked:
        print("\n=> RIEN N'A ÉTÉ VÉRIFIÉ (fichiers introuvables) — ce n'est PAS un verdict polices.")
        sys.exit(2)
    if notfound:
        print("\n[!] certains fichiers n'ont pas été trouvés (voir [?] ci-dessus).")
    print("\n=> " + ("PDF À RISQUE : corriger avant de livrer." if bad else
                     f"{checked} PDF vérifié(s) : tous sûrs."))
    sys.exit(1 if bad else (2 if notfound else 0))
