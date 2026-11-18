# -*- coding: utf-8 -*-
"""Construit un livrable HTML en PDF print via Chrome headless. GABARIT à copier
dans <livrable>/_tools/build.py puis adapter le bloc CONFIG.

Prérequis : Chrome installé + `pip install pymupdf pillow`.
Usage : python _tools/build.py
Sortie : export/<OUT_NAME>.pdf + export/_pages/*.png (contrôle visuel)

Éprouvé sur un rendu réel (PFA LARSEN 2026 : dossier A3 50 p., slides, affiches,
leaflet…). Chaque garde-fou répond à un incident VÉCU — ne pas les retirer.
Détail des pièges : references/gotchas.md du skill design-as-code.
"""
import re
import subprocess
import sys
import time
from pathlib import Path

# ── CONFIG (seule zone à adapter) ────────────────────────────────────────────
CHROME = None                # None = détection auto ; sinon chemin complet de chrome.exe
HTML = "livrable.html"       # source, relative à la racine du livrable (parent de _tools/)
OUT_NAME = "Nom-Du-Livrable" # nom du PDF final (sans .pdf) — respecter la nomenclature du rendu
MAXW = 2600                  # largeur max des images recompressées (px). 2600 ≈ 157 dpi pleine page A3.
JPEG_QUALITY = 87
VIRTUAL_TIME_MS = 20000      # budget de chargement. Trop court = CSS/images manquants ALÉATOIREMENT.
BOOKMARKS = True             # signets depuis les <section class="page"> — mettre False pour un mono-page (affiche)
CONTROL_DPI = 60             # PNG de contrôle par page (0 = désactivé)
# ─────────────────────────────────────────────────────────────────────────────

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    str(Path.home() / r"AppData\Local\Google\Chrome\Application\chrome.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def chrome_path() -> str:
    if CHROME:
        if Path(CHROME).exists():
            return CHROME
        raise SystemExit(f"[X] CHROME configuré mais introuvable : {CHROME}")
    for c in CHROME_CANDIDATES:
        if Path(c).exists():
            return c
    raise SystemExit("[X] Chrome introuvable : renseigner CHROME dans le bloc CONFIG.")


def verifie_ecriture(pdf: Path):
    """Refuse de builder si le PDF cible est verrouillé par un lecteur ouvert.

    Windows : un PDF ouvert dans Acrobat/l'aperçu Explorer bloque le remplacement.
    Sans ce garde, le build affiche « OK » en lisant l'ANCIEN fichier — vécu :
    3 h de corrections invisibles, le PDF déposé figé à une version antérieure.
    """
    if not pdf.exists():
        return
    try:
        with open(pdf, "r+b"):
            pass
    except PermissionError:
        raise SystemExit(
            f"[X] {pdf.name} est verrouillé (Acrobat ? aperçu Explorer ?). "
            f"Ferme-le puis relance : le build ne peut pas écrire par-dessus.")


def verifie_ressources(html: Path):
    """Chaque <link rel=stylesheet> doit résoudre vers un fichier existant.

    Un href de CSS/fonts cassé ne fait AUCUNE erreur : le navigateur replie sur
    les polices système et le PDF part avec les mauvaises polices (piège n°1 du
    skill). On échoue bruyamment AVANT le rendu plutôt que silencieusement après.
    """
    txt = re.sub(r"<!--.*?-->", "", html.read_text(encoding="utf-8"), flags=re.S)
    for m in re.finditer(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', txt):
        href = m.group(1)
        if href.startswith(("http:", "https:", "data:")):
            print(f"   [!] stylesheet DISTANT ({href}) : rendu dépendant du réseau — self-hoster.")
            continue
        target = (html.parent / href).resolve()
        if not target.exists():
            raise SystemExit(
                f"[X] stylesheet introuvable : {href} (résolu : {target})\n"
                f"    Un lien cassé = polices/styles système en silence. Corriger le href "
                f"(fonts/ à la racine du projet -> ../../fonts/fonts.css depuis un livrable).")


def render(chrome: str, html: Path, pdf: Path):
    """HTML -> PDF. --virtual-time-budget est OBLIGATOIRE : sans lui Chrome
    imprime avant la fin du chargement (webfonts/images absentes, aléatoire)."""
    # Garde anti-build-fantôme n°2 (vécu sur le moodboard FZN, 29/09/2026) : Chrome a laissé
    # l'ANCIEN PDF en place sans erreur, verifie_ecriture n'a rien vu, et le script affichait
    # « OK » en lisant la taille du vieux fichier. On supprime la cible avant, on exige un
    # fichier neuf après (cf. gotchas §4a-bis).
    t0 = time.time()
    if pdf.exists():
        pdf.unlink()
    try:
        subprocess.run([chrome, "--headless=new", "--disable-gpu",
                        f"--virtual-time-budget={VIRTUAL_TIME_MS}",
                        f"--print-to-pdf={pdf}",
                        "--no-pdf-header-footer",
                        html.as_uri()], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        sys.stderr.write(e.stderr.decode(errors="replace") if e.stderr else "")
        raise SystemExit(f"[X] Chrome a échoué (code {e.returncode}) — stderr ci-dessus.")
    if not pdf.exists() or pdf.stat().st_mtime < t0 - 1:
        raise SystemExit(f"[X] Chrome n'a pas écrit {pdf.name} : aucun PDF neuf. Build refusé.")
    print("OK", pdf.name, f"({pdf.stat().st_size // 1024} Ko)")


def compress(pdf: Path):
    """Recompresse le grain/les images rastérisés par Chrome (ex : 118 Mo -> 12 Mo).

    Image par image via page.replace_image : SURTOUT PAS rewrite_images(), qui
    perd les Pattern (dégradés CSS -> shading patterns) et casse le rendu.
    Sauvegarde en 2 PASSES : modifs + garbage dans le même save corrompt les polices.
    """
    import io
    import fitz
    from PIL import Image
    doc = fitz.open(pdf)
    seen, n = set(), 0
    for page in doc:
        for img in page.get_images(full=True):
            xref, smask = img[0], img[1]
            if xref in seen:
                continue
            seen.add(xref)
            try:
                stored = len(doc.xref_stream_raw(xref))
                if stored < 300_000 and not smask:
                    continue
                pix = fitz.Pixmap(doc, xref)
                if smask:
                    pix = fitz.Pixmap(pix, fitz.Pixmap(doc, smask))
                if max(pix.width, pix.height) <= MAXW and stored < 300_000:
                    continue
                im = Image.open(io.BytesIO(pix.tobytes("png")))
                if max(im.size) > MAXW:
                    r = MAXW / max(im.size)
                    im = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))),
                                   Image.LANCZOS)
                buf = io.BytesIO()
                if im.mode == "RGBA":
                    im.quantize(160, method=Image.FASTOCTREE).save(buf, "PNG", optimize=True)
                else:
                    im.convert("RGB").save(buf, "JPEG", quality=JPEG_QUALITY)
                if len(buf.getvalue()) < stored:
                    page.replace_image(xref, stream=buf.getvalue())
                    n += 1
            except Exception as e:
                print("   skip xref", xref, ":", e)
    tmp = pdf.with_suffix(".tmp.pdf")
    doc.save(tmp, deflate=True)              # passe 1 : modifs seules
    doc.close()
    doc = fitz.open(tmp)
    tmp2 = pdf.with_suffix(".tmp2.pdf")
    doc.save(tmp2, garbage=4, deflate=True)  # passe 2 : garbage collection seule
    doc.close()
    tmp.unlink()
    try:
        tmp2.replace(pdf)
    except PermissionError:
        raise SystemExit(
            f"[X] {pdf.name} verrouillé au moment de la compression : le PDF est resté "
            f"NON COMPRESSÉ ({pdf.stat().st_size // 1024 // 1024} Mo). Ferme-le et relance.")
    print(f"   compressé: {pdf.stat().st_size // 1024 // 1024} Mo ({n} images réécrites)")


def page_map(html: Path):
    """Par page (dans l'ordre) : (partie, sous-titre), lus dans le fil d'ariane.

    Convention (cf. assets/template) : <section class="page ..."> = 1 page PDF ;
    dedans, <div class="crumb"><span class="part">…</span><span class="mono">…</span></div>.
    Les commentaires HTML **et CSS** sont retirés AVANT le découpage : un exemple de
    balisage commenté déclencherait sinon une fausse page (vécu : set_toc plantait
    sur le propre gabarit du skill). Les sections « pg-off » (masquées CSS) sont ignorées.
    """
    txt = html.read_text(encoding="utf-8")
    txt = re.sub(r"<!--.*?-->", "", txt, flags=re.S)
    txt = re.sub(r"/\*.*?\*/", "", txt, flags=re.S)
    secs = re.split(r'<section class="page', txt)[1:]
    pages = []
    for s in secs:
        if re.match(r'[^"]*pg-off', s):
            continue
        m = re.search(r'<span class="part">(.*?)</span>\s*<span class="mono">(.*?)</span>', s, re.S)
        part = sub = ""
        if m:
            part = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(1))).strip()
            sub = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(2))).strip()
        pages.append((part, sub))
    return pages


def add_bookmarks(pdf: Path, html: Path):
    """Signets hiérarchiques (partie > sous-titre) posés PAR CODE, via saveIncr."""
    import html as _html
    import fitz
    pages = page_map(html)
    if not pages:
        print('   (pas de <section class="page"> : signets sautés)')
        return
    doc = fitz.open(pdf)
    if len(pages) != len(doc):
        print(f"   [!] {len(pages)} sections pour {len(doc)} pages PDF : une section "
              f"déborde probablement sur 2 pages — signets décalés/tronqués, à vérifier.")

    def key(part):
        m = re.match(r'(\d{2})', part or "")
        return m.group(1) if m else part

    toc, cur = [], None
    for i, (part, sub) in enumerate(pages, 1):
        if i > len(doc):     # jamais d'entrée hors bornes : set_toc planterait
            break
        part = _html.unescape(part)
        sub = _html.unescape(sub)
        if i == 1:
            toc.append([1, "Couverture", 1])
            cur = "_cov"
            continue
        if part:
            k = key(part)
            if k != cur:
                toc.append([1, part, i])
                cur = k
        if sub:
            toc.append([2, sub, i])
    try:
        doc.set_toc(toc)
        doc.saveIncr()
    except PermissionError:
        raise SystemExit(f"[X] {pdf.name} verrouillé pendant la pose des signets. "
                         f"Ferme le lecteur et relance.")
    finally:
        doc.close()
    print(f"   signets: {len(toc)} entrées")


def controle_visuel(pdf: Path, out: Path):
    """Chaque page en PNG basse résolution : indispensable pour relire/auditer le
    rendu réel (l'extraction de texte ne prouve rien, seul le rendu fait foi)."""
    import fitz
    doc = fitz.open(pdf)
    pages = out / "_pages"
    pages.mkdir(exist_ok=True)
    try:
        for i, p in enumerate(doc, 1):
            p.get_pixmap(dpi=CONTROL_DPI).save(pages / f"p{i:02d}.png")
    except PermissionError:
        raise SystemExit("[X] écriture des PNG de contrôle refusée (fichier ouvert ?).")
    print("OK", len(doc), "pages PNG dans export/_pages/")


def main():
    root = Path(__file__).resolve().parent.parent
    html = root / HTML
    if not html.exists():
        raise SystemExit(f"[X] source introuvable : {html}")
    chrome = chrome_path()
    verifie_ressources(html)
    out = root / "export"
    out.mkdir(exist_ok=True)
    pdf = out / f"{OUT_NAME}.pdf"
    verifie_ecriture(pdf)
    render(chrome, html, pdf)
    compress(pdf)
    if BOOKMARKS:
        add_bookmarks(pdf, html)
    if CONTROL_DPI:
        controle_visuel(pdf, out)
    print("\nContrôle final conseillé : python <skill>/scripts/check_pdf_fonts.py", pdf)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
