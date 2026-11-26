# Gotchas de la chaîne HTML/CSS → Chrome → PDF

Chaque entrée vient d'un incident **réellement vécu** sur un rendu noté (PFA LARSEN 2026 :
dossier A3 50 p., deck 24 slides, affiches, leaflet, fanzine, papeterie, packaging).
Format : symptôme → mécanisme → remède.

---

## 1. POLICES — la famille de bugs la plus dangereuse

Symptôme commun : **le PDF est parfait sur la machine qui l'a produit, illisible ailleurs**
(« texte en points façon braille », alerte de police manquante chez le lecteur).
Mécanisme commun : quand Chrome ne peut pas embarquer une vraie police, il **rastérise le
texte en polices Type3** (glyphes dessinés, sans table de caractères). Les lecteurs qui
gèrent mal le Type3 affichent des points. C'est indétectable à l'œil sur le poste de
production — seul un contrôle outillé le voit.

Trois causes distinctes, même symptôme :

### 1a. Le CSS ment : graisse déclarée ≠ fichier servi
`@font-face` dupliqué à la main : `font-weight: 700` mais `src:` pointant toujours le
fichier `-400-`. La graisse « existe » pour le CSS, jamais pour de vrai → faux gras
synthétisé → Type3. **Le piège le plus vicieux : le CSS a l'air correct.**
→ Remède : ne JAMAIS écrire fonts.css à la main. Le générer avec `scripts/fetch_fonts.py`
(mapping graisse→fichier garanti par code, magic bytes `wOF2` vérifiés).

### 1b. Police mono-graisse posée sur un élément gras
`.titre{font-family:"Anton"}` sur un `<h1>`/`<h2>`/`<b>` : ces éléments valent
`font-weight:700` par défaut, Anton n'existe qu'en 400 → faux gras → Type3.
→ Remède : `font-weight:400` explicite dans CHAQUE règle qui pose une police
mono-graisse. Vérifiable par grep : toute déclaration `font-family:"Anton"` sans
`font-weight` adjacent est un bug latent.

### 1c. Police variable
`format('woff2-variations')`, `font-weight: 100 900` : parfait à l'écran, mais **Chrome
ne sait pas embarquer une police variable dans un PDF** — il la rastérise. Un correctif
« propre » du bug 1b par une variable reproduit donc le symptôme qu'il voulait guérir.
→ Remède : graisses **statiques uniquement** dans toute chaîne qui finit en PDF.

### Preuve du mécanisme (pour s'en souvenir)
Sur l'incident d'origine, Courier Prime était la seule famille dont chaque graisse
pointait vers son vrai fichier — et la seule restée intacte du premier coup.

### 1d. Diagnostic express d'un PDF suspect
`python scripts/check_pdf_fonts.py <fichier.pdf>` — trois verdicts :
- **Type3** → texte rastérisé (causes 1a/1b/1c, ou 1f ci-dessous) : à corriger absolument ;
- **police non embarquée** → dépend des polices installées chez le lecteur : à corriger ;
- **police système embarquée** (SegoeUI, Arial, Consolas, MS-PGothic…) → une webfont n'a
  pas chargé, Chrome a pris un repli silencieux : chercher laquelle et pourquoi.
La présence de `MS-PGothic`/`Arial` dans un PDF censé n'utiliser que des webfonts est
TOUJOURS le signe d'un trou (graisse absente, glyphe hors subset, CSS non chargé).

### 1e. Symboles hors subset
`✓ ✕ ⊘ →` n'existent pas dans les subsets latin/latin-ext → repli système ou Type3.
→ Remède print : pictos en **SVG inline**, pas en caractère. (L'`→` passe car il est
dans le range latin de Google — mais tester, cf. 1d.)

### 1f. Effets CSS qui rastérisent le texte
`text-shadow` (même discret) sur du texte le fait rastériser en Type3 par le moteur
print. `mix-blend-mode`/`filter` sur un bloc peuvent rastériser tout le bloc.
→ Remède : pas de text-shadow en print ; réserver blend/filters aux fonds décoratifs,
jamais aux conteneurs de texte.

### 1g. Jury hors-ligne
Les polices se self-hostent (woff2 locaux) : un `<link>` Google Fonts distant = rendu
qui dépend du wifi de la salle. `fetch_fonts.py` règle ça par construction.

### 1h. Police locale / licenciée (hors catalogue Fontsource)
Cas client banal (police de marque achetée, OTF fournie). La règle « ne jamais écrire
fonts.css à la main » a une voie de sortie ENCADRÉE :
1. obtenir/convertir **un woff2 statique PAR graisse utilisée** (jamais la variable) ;
2. vérifier les magic bytes de chaque fichier (`open(f,'rb').read(4) == b'wOF2'`) ;
3. écrire les blocs `@font-face` sur le modèle EXACT de la sortie de `fetch_fonts.py`
   (un bloc par graisse×subset, `src` pointant le fichier de SA graisse, mêmes
   `unicode-range`) — de préférence les faire générer par un petit script, pas à la main ;
4. valider le PDF final par `check_pdf_fonts.py` (le juge de paix reste le contrôle).

### 1i. Noms internes trompeurs
Les woff2 Fontsource s'embarquent parfois sous un nom interne du type
`MontserratThin-SemiBold` : c'est bien le SemiBold correct. Seuls le SUFFIXE du nom
et le rendu des PNG de contrôle font foi — pas le « Thin » du milieu.

---

## 2. CHROME HEADLESS

### 2a. Impression avant la fin du chargement
Sans `--virtual-time-budget=20000`, Chrome imprime parfois avant la fin du chargement :
CSS partiellement appliqué, images/webfonts absentes, **de façon aléatoire d'un build à
l'autre** (le pire type de bug). → Toujours passer le flag (déjà dans `build.py`).

### 2b. La commande de référence
```
chrome --headless=new --disable-gpu --virtual-time-budget=20000 \
       --print-to-pdf=<out.pdf> --no-pdf-header-footer <file:///…>
```
`@page{size:<W>mm <H>mm;margin:0}` dans le CSS fixe le format exact du PDF.
Chemins `file://` sous Windows : `Path.as_uri()` (jamais de backslashes bruts).

### 2c. Captures d'écran mobiles trompeuses
Chrome headless Windows **clampe le viewport à ~484 px** en mode screenshot → faux
débordements « mobile ». Pour vérifier du responsive, utiliser Playwright avec
`viewport` explicite + `device_scale_factor=2`, pas `--screenshot`.

### 2d. Métadonnées
Un PDF Chrome dit `producer: Skia/PDF`, `creator: HeadlessChrome`. C'est visible dans
les propriétés du fichier. Renseigner `<title>` (repris comme titre du PDF) est de
l'hygiène ; **falsifier le producer (le faire passer pour InDesign) sur un rendu noté
est interdit** — si la méthode est autorisée, elle n'a pas à se cacher ; si elle ne
l'est pas, le maquillage aggrave.

---

## 3. POST-TRAITEMENT PyMuPDF (fitz)

### 3a. Compression : `replace_image`, jamais `rewrite_images`
`rewrite_images()` perd les Pattern (dégradés CSS → shading patterns) et casse le rendu.
Compresser image par image via `page.replace_image(xref, …)` (fait dans `build.py`).

### 3b. Sauvegarde en 2 passes
Modifications + `garbage=4` dans le MÊME `save()` **corrompt les polices**. Toujours :
passe 1 `save(tmp, deflate=True)` → rouvrir → passe 2 `save(tmp2, garbage=4, deflate=True)`.

### 3c. Signets sans rebuild
`doc.set_toc(toc)` + `doc.saveIncr()` pose l'outline sur le PDF EXISTANT (pas de
re-render). Les ancres HTML `<a href="#id">` sont exportées par Chrome en liens PDF
internes → sommaire cliquable sans outil externe.

### 3d. Extraction de texte ≠ preuve d'absence
`page.get_text()` ne « voit » pas le texte des polices display converties en tracés ni
certains styles. Pour vérifier qu'une correction est dans le PDF, regarder le rendu
(PNG de contrôle), pas seulement le texte extrait.

---

## 4. WINDOWS

### 4a. PDF verrouillé = build fantôme
Un PDF ouvert (Acrobat, apercu Explorer) bloque `os.replace`. Sans garde-fou, le build
affiche « OK » en lisant l'ANCIEN fichier → des heures de corrections invisibles, un
dépôt figé à une vieille version (vécu). `build.py` refuse de démarrer si la cible est
verrouillée et échoue BRUYAMMENT si la compression ne peut pas écrire.

### 4a-bis. PDF jamais réécrit = build fantôme n°2 (le garde 4a ne le voit pas)
Vécu sur le moodboard FZN (29/09/2026) : `--print-to-pdf` n'a PAS remplacé le PDF
existant, Chrome est sorti sans erreur, le test `open(pdf, "r+b")` de 4a est passé, et
`build.py` affichait « OK <nom>.pdf » en lisant la taille de l'ANCIEN fichier. Plusieurs
rebuilds « réussis », PDF figé à une vieille version ; repéré seulement en comparant les
mtimes. Cause exacte côté Chrome non élucidée — d'où un garde sur le RÉSULTAT, pas sur
une hypothèse. → Remède (dans `render()`) : noter `t0`, **supprimer la cible avant**
d'appeler Chrome, puis refuser le build si le PDF est absent ou si `mtime < t0 - 1`.
Règle générale : un « OK » ne se déduit jamais de l'existence du fichier de sortie,
seulement d'une preuve qu'il est NEUF.

### 4b. Console cp1252
`print()` d'un ✓/emoji plante les scripts (`UnicodeEncodeError`). En tête de tout
script : `sys.stdout.reconfigure(encoding="utf-8")` ; éviter les emojis dans les logs.

### 4c. Édition de fichiers à espaces insécables
Le texte français print est truffé de NBSP (avant `: ; %`) et d'apostrophes courbes →
les remplacements exacts échouent silencieusement. Préférer des remplacements Python
courts ancrés sur des sous-chaînes ASCII, et vérifier `changed: True`.

---

## 5. ORGANISATION QUI SAUVE UN RENDU

### 5a. Structure par livrable
```
Projet/
├── Livrables/<Nom>/         (livrable.html + _tools/build.py + export/)
├── fonts/                   (woff2 partagés + fonts.css GÉNÉRÉ)
└── Rendu_Final/             (assemblé par _tools/collect.py, JAMAIS à la main)
```
1 livrable = 1 HTML = 1 build. Le rendu final se regénère par script (nomenclature
imposée, renommages, détection des manquants/verrouillés/inattendus) — la copie à la
main oublie toujours quelque chose. ⚠️ `_tools/` vit DANS le dossier de dépôt mais ne
s'UPLOADE pas : le dépôt = uniquement les fichiers nomenclaturés.

### 5b. PNG de contrôle systématiques
`export/_pages/*.png` à chaque build : c'est ce qui permet de relire le rendu réel,
de le faire auditer par des agents, et d'attraper les pages cassées sans ouvrir le PDF.

### 5c. Audits multi-agents avant dépôt
Sur un rendu réel, 3 vagues d'audit indépendantes ont chacune attrapé des bloquants que
la précédente avait manqués (stat mal formulée, sommaire faux, item imposé absent,
renvois cassés, folios faux). Protocole : (1) audit ciblé brief/nomenclature,
(2) re-vérification post-corrections, (3) lecture fraîche de TOUTES les pages rendues.
Vérifier les affirmations des auditeurs dans les fichiers (il y a des faux positifs).

### 5d. Checklist finale avant dépôt
1. `check_pdf_fonts.py` sur TOUS les PDF (§1d) ;
2. chaque PDF ouvert une fois (pages, images, rien de vide) ;
3. nomenclature exacte du brief (chaque écart coûte des points) ;
4. nombre de pages attendu ; 5. pas de fichier parasite dans le dépôt.

### 5e. Filet ultime : vectoriser
Si un Type3 résiste ou qu'on veut un rendu bit-à-bit identique partout :
`gs -o out.pdf -sDEVICE=pdfwrite -dNoOutputFonts in.pdf` (Ghostscript) convertit tout
le texte en tracés. Prix : texte non sélectionnable, fichier plus lourd. À réserver au
dépôt, jamais à la version de travail.

---

## 6. PRINT — règles métier minimales

- **Fond perdu** : page = format fini + 2×fond perdu. Règle de décision : **≤ A3 = 3 mm,
  affiches ≥ 40×60 cm = 5 mm**, au-delà demander à l'imprimeur. Exemples complets
  (fini → @page) : A4 210×297+3 → 216×303 ; A3 297×420+3 → 303×426 ; 40×60 cm
  400×600+5 → 410×610. Tout élément « plein bord » déborde DANS le fond perdu ;
  marges intérieures ≥ 20 mm du format fini pour un poster.
- **Traits de coupe** : posés par code dans la zone de fond perdu (cf. template).
- **Images** : viser ≥ 150 dpi au format final réel ; la compression `build.py` (MAXW)
  se règle sur la largeur de page. En 4K source, laisser compresser à l'export.
- **Couleur** : Chrome sort du RGB. Pour l'offset sérieux, la conversion CMJN se fait
  chez l'imprimeur (le noter dans une fiche imprimeur) ; les tons directs fluo ne se
  simulent pas en RGB — l'assumer et le documenter. **Tout ton direct (Pantone/fluo)
  doit avoir son substitut CMJN documenté dans la charte** (exigé par un jury pro :
  sans lui, la pièce n'est pas imprimable en quadri standard).
- **Typo FR** : espaces insécables avant `: ; ! ? %`, guillemets « », apostrophe
  typographique. (Interdits spécifiques au client — ex. tirets cadratins — à vérifier
  par grep sur le CONTENU RENDU, pas les commentaires.)
- **Typo FR par code : JAMAIS sur du CSS ni une URL.** Vécu sur le moodboard FZN
  (29/09/2026) : la passe « insécable avant `:` » tournait sur les VALEURS du JSON de
  contenu AVANT le gabarit. Le champ `pos` (`object-position:42% 40%`), injecté ensuite
  dans `style=""`, est devenu `object-position :42% 40%` (NBSP) → déclaration invalide,
  ignorée SANS erreur : tous les recadrages d'image tombés d'un coup. Sauter les balises
  (`<…>`) ne suffit pas, puisque le CSS n'est pas encore dans une balise au moment de la
  passe. Même mécanisme pour tout `src`/`href` (`https://` → `https :`).
  → Remède : exclure explicitement de la passe typo les champs destinés à `style`/`src`/
  `href` (liste de clés, comme `applique()` dans FZN `outils/fabrique.py`) ; et contrôler
  le HTML RENDU : aucun U+00A0 dans un attribut `style="…"`, `src="…"` ou `href="…"`.

### Règles d'identité issues d'un retour de jury réel (19/20, les points retirés = ceux-ci)
- **Maximum 3 typographies** dans une identité — au-delà, « le client/utilisateur
  visuel s'y perd ». Compter TOUTES les familles, y compris la mono de service.
- Planche typographie d'une charte : indiquer **le créateur/la fonderie ET le prix
  (ou la licence) de chaque police**. Vérifiable — ne jamais inventer un prix (cf. le
  pilier « aucun chiffre non sourcé ») : « licence payante » suffit si le tarif n'est
  pas public.
- **Logo : tester la lisibilité de la baseline à taille réelle** d'usage, et vérifier
  l'équilibre horizontal du lockup (un déséquilibre se voit en jury avant tout le reste).
- **Formats éditoriaux : sobre par défaut.** Un leaflet/flyer « trop grand » est le
  reproche unanime le plus facile à éviter — en cas de doute, prendre le format
  standard en dessous.
- **Affiche : hiérarchiser les niveaux de lecture** (1 message à 5 m, 1 à 2 m, 1 à
  bout de bras) et le vérifier sur le PNG de contrôle réduit à 10 % (simulation vue de loin).
