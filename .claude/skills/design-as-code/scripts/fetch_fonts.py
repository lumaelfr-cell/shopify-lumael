# -*- coding: utf-8 -*-
"""Télécharge des webfonts en graisses STATIQUES et génère un fonts.css au mapping graisse->fichier garanti.

Source : CDN Fontsource/jsDelivr (familles du catalogue Google, licences SIL OFL).
Police locale/licenciée hors catalogue : suivre references/gotchas.md §1h (écrire le
bloc @font-face sur le modèle EXACT de la sortie de ce script, puis valider par
check_pdf_fonts.py).

Usage :
  python fetch_fonts.py --out <dossier_fonts> "Montserrat:400,500,600,700,800,900" "Anton:400" "Courier Prime:400,700,400i"
  (suffixe i = italique ; ex. 900i = 900 italic)

Pourquoi ce script existe (incident réel, oral MJM 21/07/2026) :
un fonts.css écrit à la main déclarait Montserrat 500/700/900 mais pointait les trois
vers le fichier 400 (bloc dupliqué, src oublié). Résultat : faux gras synthétisé par
Chrome -> texte rastérisé en polices Type3 -> « braille » illisible sur le PC du jury.
Ici le mapping est généré par code : il ne peut pas mentir. Et il n'utilise QUE des
graisses statiques : les polices VARIABLES ne s'embarquent pas dans un PDF Chrome
(rastérisées aussi). Chaque fichier téléchargé est vérifié (magic bytes wOF2).
"""
import argparse
import re
import sys
import urllib.request
from pathlib import Path

CDN = "https://cdn.jsdelivr.net/fontsource/fonts/{slug}@latest/{subset}-{weight}-{style}.woff2"
SUBSETS = ("latin", "latin-ext")  # couvre le français (é à ç œ …)

# unicode-range officiels Google Fonts pour ces subsets
RANGES = {
    "latin": ("U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, "
              "U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, "
              "U+2212, U+2215, U+FEFF, U+FFFD"),
    "latin-ext": ("U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, "
                  "U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, "
                  "U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF"),
}


def slugify(family: str) -> str:
    return re.sub(r"\s+", "-", family.strip().lower())


def fetch(url: str, dest: Path) -> bool:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "design-as-code-skill"})
        data = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        print(f"  FAIL {url} : {e}")
        return False
    if data[:4] != b"wOF2":
        print(f"  FAIL {dest.name} : pas un woff2 (magic {data[:4]!r})")
        return False
    dest.write_bytes(data)
    print(f"  OK   {dest.name} ({len(data)//1024} Ko)")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", required=True, help="dossier de sortie (ex : Gabarits_web/fonts)")
    ap.add_argument("--css", default="fonts.css", help="nom du CSS généré (défaut : fonts.css)")
    ap.add_argument("families", nargs="+",
                    help='"Famille:poids,…" — suffixe i = italique (ex : "Montserrat:400,700,900i")')
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    blocks, failed = [], 0
    for spec in a.families:
        family, _, weights = spec.partition(":")
        family = family.strip()
        slug = slugify(family)
        if not weights:
            weights = "400"
        for w in [x.strip() for x in weights.split(",") if x.strip()]:
            style = "italic" if w.endswith("i") else "normal"
            weight = w.rstrip("i")
            for subset in SUBSETS:
                sty = "italic" if style == "italic" else "normal"
                fname = f"{slug}-{weight}-{sty}-{subset}.woff2"
                url = CDN.format(slug=slug, subset=subset, weight=weight, style=sty)
                if not fetch(url, out / fname):
                    failed += 1
                    continue
                blocks.append(
                    f"/* {family} {weight} {sty} {subset} */\n"
                    "@font-face {\n"
                    f"  font-family: '{family}';\n"
                    f"  font-style: {sty};\n"
                    f"  font-weight: {weight};\n"
                    "  font-display: swap;\n"
                    f"  src: url(./{fname}) format('woff2');\n"
                    f"  unicode-range: {RANGES[subset]};\n"
                    "}")

    css = out / a.css
    header = (
        "/* GÉNÉRÉ par fetch_fonts.py (skill design-as-code) — NE PAS ÉDITER À LA MAIN.\n"
        "   Graisses STATIQUES uniquement : mapping graisse->fichier garanti par code.\n"
        "   Jamais de police variable dans une chaîne HTML->PDF (Chrome la rastérise en Type3).\n"
        "   Pour ajouter une graisse : relancer fetch_fonts.py avec la liste complète. */\n\n")
    css.write_text(header + "\n".join(blocks) + "\n", encoding="utf-8")
    print(f"\n{css} écrit : {len(blocks)} blocs @font-face.")
    if failed:
        print(f"[!] {failed} téléchargement(s) en échec — graisse inexistante chez Fontsource ? "
              f"Vérifier la liste des poids de la famille sur fontsource.org.")
        sys.exit(1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
