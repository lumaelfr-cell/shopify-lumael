---
name: design-as-code
description: This skill should be used when producing PRINT deliverables (posters, multi-page dossiers, slide decks, leaflets, zines, stationery, packaging dielines) or an assembled final submission as PDF from HTML/CSS via headless Chrome. It covers the full pipeline — project scaffold, self-hosted static webfonts, Chrome print flags, pattern-safe compression, PDF bookmarks, font-embedding verification, deposit assembly — and the hard-won traps (Type3 "braille" text, fake bold, variable fonts, locked-PDF ghost builds). Trigger on: "affiche", "dossier A3", "livrable print", "rendu final", "HTML vers PDF", "le PDF s'affiche mal chez le client/jury", "design as code".
---

# Design as Code — HTML/CSS → Chrome → PDF

Produire des livrables print de qualité jury/client à partir de HTML/CSS, avec Chrome
headless comme moteur de rendu. Pipeline éprouvée sur un rendu d'examen réel complet
(dossier A3 50 p., deck, affiches, leaflet, fanzine, papeterie, packaging) : une source
unique versionnée, rebuild en ~30 s, zéro InDesign requis.

**Philosophie** : tout ce qui peut mentir silencieusement (mapping de polices, dépôt
assemblé à la main, build sur fichier verrouillé, href cassé) doit être généré ou
vérifié PAR CODE.

## Prérequis

- **Chrome** installé (`build.py` détecte les chemins usuels ; sinon renseigner
  `CHROME` dans son bloc CONFIG).
- **Python** : `pip install pymupdf pillow` (compression, signets, contrôles, vérif polices).
- Optionnel : Ghostscript, uniquement pour le filet ultime de vectorisation
  (`references/gotchas.md` §5e).

## Conventions d'invocation

`scripts/` désigne le dossier DU SKILL (utiliser son chemin absolu). Deux familles :
- **gabarits à copier dans le projet** : `build.py` → `<livrable>/_tools/`,
  `collect.py` → `<rendu>/_tools/` ; adapter leur bloc CONFIG après copie ;
- **outils à lancer depuis le skill** : `fetch_fonts.py`, `check_pdf_fonts.py`.

## Démarrage d'un nouveau projet / livrable

1. **Scaffold** : 1 livrable = 1 dossier = 1 HTML = 1 build.
   ```
   Projet/
   ├── Livrables/<Nom>/            livrable.html + _tools/build.py + export/
   ├── fonts/                      woff2 partagés + fonts.css GÉNÉRÉ
   └── Rendu_Final/ + _tools/collect.py
   ```
   Partir de `assets/template/livrable.html` : `@page` au format exact (fini + fond
   perdu, règle de décision incluse), traits de coupe pilotés par `--bleed`, règles
   de police commentées à l'endroit où on les viole d'habitude. Son `<link>` fonts
   suppose ce scaffold (`../../fonts/fonts.css`) — l'adapter si le layout diffère ;
   `build.py` refuse de builder si un stylesheet ne résout pas.

2. **Polices — générer, ne jamais écrire à la main** :
   ```bash
   python <skill>/scripts/fetch_fonts.py --out Projet/fonts "Montserrat:400,500,600,700,800,900" "Anton:400"
   ```
   Lister TOUTES les graisses que le CSS utilisera (chaque `font-weight` du projet doit
   avoir son fichier). Trois règles absolues, chacune issue d'un incident réel :
   - chaque `@font-face` pointe vers SON fichier de graisse (garanti par le script) ;
   - police mono-graisse (Anton, display) → `font-weight:400` explicite dans chaque
     règle CSS qui la pose, sinon `<h1>/<b>` déclenchent un faux gras ;
   - **jamais de police variable** dans une chaîne qui finit en PDF.
   Pourquoi c'est vital : toute entorse fait rastériser le texte en polices **Type3**,
   PDF parfait sur la machine de production mais « braille » illisible chez le
   destinataire. Mécanisme : `references/gotchas.md` §1. Police locale/licenciée hors
   catalogue Fontsource : voie encadrée en §1h.

3. **Build** : copier `scripts/build.py` dans `<livrable>/_tools/`, adapter le bloc
   CONFIG (`CHROME` si non détecté, `HTML`, `OUT_NAME`, `MAXW`, `BOOKMARKS=False`
   pour un mono-page). Il enchaîne : vérif des stylesheets → garde anti-PDF-verrouillé
   → suppression de la cible → Chrome (`--virtual-time-budget` obligatoire) → exige un
   PDF neuf (mtime) → compression pattern-safe 2 passes → signets → PNG de contrôle.
   Ne pas retirer les garde-fous : chacun répond à un incident vécu (build fantôme
   « OK » sur fichier verrouillé ou jamais réécrit, polices corrompues par un save
   unique, images/CSS manquants aléatoirement, href cassé silencieux).

4. **Vérifier — TOUJOURS avant de livrer** :
   ```bash
   python <skill>/scripts/check_pdf_fonts.py "export/*.pdf"
   ```
   (le script expanse lui-même les motifs `*` — PowerShell ne le fait pas).
   Échec = Type3 ou police non embarquée (à corriger absolument) ; alerte = police
   système embarquée (choix volontaire, ou webfont qui n'a pas chargé : trouver
   laquelle). Puis regarder les PNG de `export/_pages/` — l'extraction de texte ne
   prouve rien, seul le rendu fait foi.

5. **Rendu final** : copier `scripts/collect.py` dans `Rendu_Final/_tools/`, remplir
   SOURCES / RENAMES / IMAGE_DIRS. Le dépôt se REGÉNÈRE toujours par script : il
   signale manquants, **verrouillés** (vieille version restée en place = ghost build)
   et **inattendus** (doublons « (1).pdf », brouillons), et sort en code 1 si un seul
   existe. Ne pas uploader `_tools/`.

## Documents multi-pages (dossier, magazine, deck)

Une `<section class="page">` par page, à la taille exacte de `@page` (CSS d'exemple
commenté dans le template : `.page`, `.crumb`, `.part`, `.mono`, `.folio`). Fil
d'ariane `.crumb` (`span.part` + `span.mono`) dans chaque section → `build.py` en
dérive les signets PDF hiérarchiques. Une section masquée porte la classe `pg-off`
(ignorée des signets). Ancres `<a href="#id">` → liens internes cliquables dans le
PDF (sommaire, renvois « → p.XX », page de synthèse).

## Avant un dépôt qui compte

Suivre `references/gotchas.md` §5 : audits multi-agents en vagues (chaque vague
fraîche attrape ce que la précédente a manqué — vérifié 3 fois sur 3), checklist
finale (polices, ouverture réelle de chaque PDF, nomenclature exacte, pages,
parasites). En dernier recours contre un Type3 résistant : vectoriser (gotchas §5e).

## Diagnostic d'un PDF qui « s'affiche mal ailleurs »

1. `python <skill>/scripts/check_pdf_fonts.py <fichier.pdf>` → identifier Type3 /
   non-embarqué / police système.
2. Croiser avec `references/gotchas.md` §1 (mapping menteur, faux gras, variable,
   symbole hors subset, text-shadow, href cassé).
3. Corriger la source, re-builder, re-vérifier — et regarder les PNG de contrôle.

## Ressources

- `scripts/fetch_fonts.py` — webfonts statiques + fonts.css au mapping garanti (outil).
- `scripts/check_pdf_fonts.py` — verdict d'embarquement des polices d'un PDF (outil).
- `scripts/build.py` — gabarit de build à copier (Chrome → compression → signets → contrôles).
- `scripts/collect.py` — gabarit d'assemblage du rendu final à copier.
- `assets/template/livrable.html` — gabarit print (fond perdu, coupes, règles commentées).
- `references/gotchas.md` — TOUS les pièges (polices §1, Chrome §2, fitz §3, Windows §4,
  organisation/audits §5, règles print §6). Le lire avant de débugger quoi que ce soit.
