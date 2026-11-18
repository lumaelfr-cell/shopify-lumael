# -*- coding: utf-8 -*-
"""Assemble le dossier de RENDU FINAL depuis les exports des livrables. GABARIT à
copier dans <rendu>/_tools/collect.py puis adapter le bloc CONFIG.

Usage : python _tools/collect.py
- copie chaque fichier final sous son nom de dépôt (nomenclature stricte)
- vérifie présence + taille + nombre de pages
- signale les MANQUANTS, les VERROUILLÉS (vieille version restée en place) et
  les INATTENDUS (doublons « (1).pdf », brouillons) — code retour 1 si un seul
  de ces problèmes existe : un dépôt douteux ne doit jamais passer en silence.

Règles apprises sur un rendu réel :
- le dépôt se REGÉNÈRE toujours par ce script (la copie à la main oublie un
  fichier, garde un vieux nom, ou dépose un brouillon) ;
- un fichier verrouillé (Acrobat ouvert) laisse l'ANCIENNE version dans le dépôt :
  sans compteur agrégé c'est le « ghost build » — dépôt figé, résumé tout vert.
"""
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# ── CONFIG (seule zone à adapter) ────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent.parent   # racine du projet
DEST = ROOT / "Rendu_Final"                            # dossier de dépôt
# Chemins relatifs à ROOT des fichiers finaux, copiés SOUS LEUR NOM tel quel :
SOURCES = [
    # "Livrables/Affiche/export/Prenom-NOM-Projet-Affiche.pdf",
]
# Nom d'export -> nom de dépôt imposé (quand ils diffèrent) :
RENAMES = {
    # "Slides/export/Projet-Oral.pdf": "Prenom-NOM-Projet-Presentation.pdf",
}
# Dossiers d'images à déposer tels quels (ex : posts réseaux sociaux en PNG) :
IMAGE_DIRS = {
    # "Livrables/Carrousel/export": ("slide_*.png", "Prenom-NOM-Projet-Carrousel"),
}
# ─────────────────────────────────────────────────────────────────────────────


def _copy(src: Path, dest: Path):
    try:
        shutil.copy2(src, dest)
    except PermissionError:
        print(f"  [!] VERROUILLÉ, l'ANCIENNE version reste dans le dépôt : {dest.name}")
        return False
    return True


def _pages(p: Path):
    try:
        import fitz
        return len(fitz.open(p))
    except Exception:
        return "?"


def main():
    DEST.mkdir(exist_ok=True)
    total, missing, locked = 0.0, 0, 0
    attendus = {"_tools"}          # noms légitimes dans DEST (dossier _tools inclus)
    print("── Fichiers ──")
    for rel in SOURCES:
        src = ROOT / rel
        attendus.add(src.name)
        if not src.exists():
            print(f"  [X] MANQUANT : {rel}")
            missing += 1
            continue
        if _copy(src, DEST / src.name):
            mo = src.stat().st_size / 1024 / 1024
            total += mo
            print(f"  OK  {src.name}  ({mo:.1f} Mo · {_pages(src)} p.)")
        else:
            locked += 1
    for rel, name in RENAMES.items():
        src = ROOT / rel
        attendus.add(name)
        if not src.exists():
            print(f"  [X] MANQUANT (renommé) : {rel}")
            missing += 1
            continue
        if _copy(src, DEST / name):
            mo = src.stat().st_size / 1024 / 1024
            total += mo
            print(f"  OK  {name}  ({mo:.1f} Mo · {_pages(src)} p.)  <- {src.name}")
        else:
            locked += 1
    for rel, (glob_pat, dirname) in IMAGE_DIRS.items():
        srcdir = ROOT / rel
        attendus.add(dirname)
        files = sorted(srcdir.glob(glob_pat))
        if not files:
            print(f"  [X] AUCUNE image {glob_pat} dans {rel}")
            missing += 1
            continue
        d = DEST / dirname
        d.mkdir(exist_ok=True)
        for f in files:
            if _copy(f, d / f.name):
                total += f.stat().st_size / 1024 / 1024
            else:
                locked += 1
        print(f"  OK  {dirname}/ ({len(files)} images)")

    # Inventaire : tout fichier du dépôt qui ne correspond à aucune cible attendue
    # (doublon « (1).pdf », brouillon, vieux nom) partirait dans le rendu.
    inattendus = [e.name for e in DEST.iterdir() if e.name not in attendus]
    for n in sorted(inattendus):
        print(f"  [!] INATTENDU dans le dépôt (à supprimer ou à déclarer) : {n}")

    print(f"\nTotal copié : {total:.1f} Mo · manquants : {missing} · "
          f"verrouillés : {locked} · inattendus : {len(inattendus)}")
    if locked:
        print("[!] Des fichiers verrouillés = le dépôt N'EST PAS à jour. Ferme les lecteurs et relance.")
    print("\n── Avant de déposer ──")
    print("  0. Ne PAS uploader _tools/ : le dépôt = uniquement les fichiers nomenclaturés.")
    print("  1. python <skill>/scripts/check_pdf_fonts.py \"Rendu_Final/*.pdf\"  (le script gère le motif)")
    print("  2. Ouvrir chaque PDF une fois (pages, images, rien de vide).")
    print("  3. Vérifier la nomenclature exacte imposée par le brief (chaque écart coûte).")
    if missing or locked or inattendus:
        sys.exit(1)


if __name__ == "__main__":
    main()
