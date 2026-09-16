# Thème Ulvéo — fichiers suivis dans Git

Ce dossier contient les fichiers de thème Shopify écrits depuis cette session.
La boutique est **ulveo.fr** ; le thème publié est *Ulvéo — bundles compacts*.

L'API Shopify interdit l'écriture directe sur le thème publié : les
modifications sont donc appliquées sur un thème brouillon dupliqué, à
prévisualiser puis à publier depuis l'admin Shopify.

## Fichiers

| Fichier | Rôle |
|---|---|
| `sections/ulveo-popup-reduction.liquid` | Pop-up d'inscription à la newsletter, reproduisant la composition de la capture de référence. |

| `layout/theme.liquid` | Une seule ligne ajoutée : `{% section 'ulveo-popup-reduction' %}` avant `</body>`. Le reste du fichier est identique à l'original (vérifié par somme MD5). |
| `MESURES-REFERENCE.md` | Relevé des cotes de la capture de référence et leur conversion en px CSS. |

La section est rendue depuis `layout/theme.liquid` (section statique) afin
d'apparaître sur toutes les pages, tout en restant réglable dans l'éditeur de
thème. Le pop-up étant en `position: fixed`, son emplacement dans le DOM n'a
aucune incidence sur la mise en page.

## Vérifications effectuées

- `@shopify/theme-check-node` : aucune anomalie sur les deux fichiers.
- Rendu mesuré dans Chromium : carte 385 x 386 px (référence 386 x 353 px ;
  l'écart de hauteur correspond à la mention légale, absente de la référence).
- Centrage horizontal et vertical exacts, aucun débordement horizontal,
  contenu entier visible jusqu'à 320 x 480 px.
- Sommes MD5 des fichiers déposés sur le thème identiques aux fichiers locaux.

---

## Page produit — sélecteur de lot (2e lot de modifications)

Référence : capture de pullandgo.fr. Cotes relevées dans `MESURES-BUNDLE.md`.

| Fichier | Modification |
|---|---|
| `assets/bundle-picker.css` | Réécriture complète du style des cartes aux cotes de la référence. |
| `blocks/ulveo-bundle-picker.liquid` | Une vignette par exemplaire (3 max), superposées ; le badge `x1` ne s'affiche plus sur les cartes à un seul exemplaire. Seul le bloc `.bp-card__media` change. |
| `snippets/bundle-picker-payment-icons.liquid` | Logos codés en dur remplacés par `shop.enabled_payment_types`. Google Pay était affiché alors qu'il n'est pas activé sur la boutique. |
| `templates/product.json` | 4 corrections de texte, vérifiées une à une (voir plus bas). |

### Corrections de texte appliquées

| Champ | Avant | Après |
|---|---|---|
| Accordéon | « Desription » | « Description » |
| Bouton d'achat | « Ajouter au panier » | « Je l'ajoute à mon panier » |
| Bouton rupture | « Rupture de stock » | « Momentanément épuisé » |
| Expédition | placeholder Shopify, « votre emplacement » | texte naturel, sans délai chiffré inventé |

Diff vérifié après mise en ligne : **exactement 4 différences**, aucune autre.
Prix, variantes, avis et ordre des sections strictement inchangés.

### Signalé, non modifié (information non déterminable)

- **Texte « Fabrication »** : « fabriqués localement **et** dans le monde entier »
  est contradictoire, mais le lieu réel de fabrication est inconnu — le corriger
  reviendrait à inventer une information.
- **Avis** : `avis_1` (Amélie N., Lyon) et `avis_3` (Jade E., Troyes) portent un
  texte strictement identique. Leur contenu (« 20 % plus rapide », « zéro casse »,
  « choix pro ») ne correspond pas à une scelleuse de sachets.
- **Note affichée** : 4,8 / 329 avis, saisie manuellement (`manual_summary`).

---

## Page produit — bande de vignettes sur téléphone (3e lot)

Référence : rangée de 4 vignettes sous l'image principale.
Cotes relevées dans `MESURES-VIGNETTES.md`.

| Fichier | Modification |
|---|---|
| `snippets/ulveo-product-gallery.liquid` | Nouveau. Repasse la bande de vignettes mobile en grille : 4 vignettes remplissent la largeur, les suivantes défilent. |
| `layout/theme.liquid` | Une ligne de rendu du snippet dans le `<head>`. |
| `templates/product.json` | `slideshow_mobile_controls_style` : `counter` → `thumbnails`. Seul réglage touché. |

Horizon figeait les vignettes mobiles à 44 px (6 visibles, serrées) et
affichait un simple compteur tant que la pagination mobile restait sur
`counter`. Mesuré au navigateur après correction : **86,5 × 89,5 px, 4 visibles
sur 7**, écart 5, rayon 8, aucun débordement horizontal — pour une cible de
87,7 × 92, écart 4,3, 4 visibles.

Les images sont celles du produit Ulvéo : aucune n'a été remplacée ni
supprimée. Le rayon (8 px) et le contour de la vignette active restent ceux
du thème.

---

## Bas de page produit — finition et animations (4e lot)

Objectif : retenir l'attention de « Étapes Ulvéo » jusqu'au bas de page.

| Fichier | Modification |
|---|---|
| `snippets/ulveo-page-style.liquid` | Nouveau. Couche additive sur les 5 sections Ulvéo : apparition au défilement, parcours numéroté, pastilles de verdict, barres d'avis animées, FAQ en cartes. |
| `layout/theme.liquid` | Une ligne de rendu du snippet. |

Aucun balisage de section n'est modifié, aucun jeu de couleurs n'est imposé :
tout se greffe sur les classes existantes et se retire en supprimant ce seul
fichier.

### Vérifié au navigateur (393 px et 1280 px)

- 18 éléments animés, **0 resté invisible** dans les deux largeurs.
- `prefers-reduced-motion` : 0 élément caché, aucune animation.
- Sans JavaScript : 0 élément masqué — le contenu reste intégralement lisible.
- Aucun débordement horizontal.
- Page mobile ramenée de **2910 à 2350 px** (−19 %).

### Deux bugs attrapés à la mesure

- Les cartes d'avis 3 et 4 sont hors écran horizontalement dans le carrousel :
  elles n'entraient jamais en intersection et seraient restées invisibles.
  C'est désormais la bande entière qui est révélée, pas chaque carte.
- La marge basse de 10 % de l'observateur empêchait le tout dernier élément
  de la page d'atteindre le seuil. Remplacée par 40 px et un seuil à zéro.

### Comparatif sur téléphone

Les deux colonnes étaient empilées : il fallait faire défiler entre l'avant et
l'après, ce qui annulait l'intérêt d'un comparatif. Elles sont désormais côte
à côte (étiquette 130 px dans une image de 172 px, aucun débordement).

---

## Note à côté du prix (5e lot)

| Fichier | Modification |
|---|---|
| `blocks/ulveo-rating.liquid` | Nouveau. Étoiles + note + nombre d'avis, cliquable vers la section Avis. |
| `templates/product.json` | Le prix est déplacé dans un groupe horizontal « Prix et note ». Aucun autre bloc touché. |

### Source de la note

1. Métachamps produit `reviews.rating` / `reviews.rating_count` s'ils existent.
   **Aucune application d'avis n'est installée aujourd'hui** : ces métachamps
   sont absents du produit (vérifié via l'API).
2. À défaut, les champs du bloc, saisis à la main.
3. Si aucune source n'est renseignée, **le bloc ne rend rien**.

La valeur posée (4,8 / 329) est celle déjà publiée par la section « Avis
clients Ulvéo » : aucun chiffre nouveau n'a été inventé. Elle reste toutefois
**déclarative** tant qu'aucune application d'avis ne l'alimente, et elle existe
désormais à deux endroits — à garder cohérents.

### Vérifié au navigateur

- Note à droite du prix, même ligne, écart 12 px, en 393 px comme en 1280 px.
- `vertical_on_mobile: false` : la note reste à droite du prix sur téléphone.
- Remplissage partiel exact : 4,8 → 96 % (dernière étoile aux 4/5).
  Contrôlé aussi à 5,0 / 4,5 / 3,5 / 1,0.
- Aucun débordement horizontal.
- `theme-check` : aucune anomalie.

---

## Passe de finition (6e lot) — contrastes

Audit systématique des couleurs introduites, ratio WCAG calculé pour chaque
paire texte/fond. **6 contrastes insuffisants trouvés, 4 corrigés.**

| Élément | Avant | Après | Seuil |
|---|---|---|---|
| Bouton « Je l'ajoute à mon panier » | 3,38:1 | **4,64:1** | 4,5 |
| Badge « Meilleure offre » | 3,38:1 | **4,64:1** | 4,5 |
| Prix barré | 3,29:1 | **4,96:1** | 4,5 |
| Sur-titre de la garantie | 2,87:1 | **5,08:1** | 4,5 |
| Bordure FAQ ouverte | 1,92:1 | **3,15:1** | 3,0 |

L'accent passe de `#E8622C` à `#CB4A16` : **même teinte**, luminosité abaissée
de 10 %. C'est le premier palier qui fait passer le blanc du bouton au-dessus
de 4,5:1. Un sur-titre en petites capitales sur fond crème ne suffisait pas
même ainsi : il utilise `--ulveo-accent-strong` (`#A8441A`, 5,08:1).

### Non corrigé, et pourquoi

- **Étoiles dorées `#f0b400` sur blanc : 1,87:1.** C'est la couleur d'origine
  de votre section Avis. Les étoiles portent `aria-hidden`, la note chiffrée
  est juste à côté en texte, et un libellé lisible par lecteur d'écran double
  l'information : elles sont décoratives, pas porteuses de sens.
- **Bouton du pop-up en brun `#7a462e` (7,66:1).** Contraste excellent, mais
  c'est une couleur d'action différente de l'orange du reste. Cohérence ou
  hiérarchie : c'est un choix de marque, pas un défaut.

### Autres contrôles

- Intégrité : les 8 fichiers en ligne correspondent au dépôt (somme MD5).
- `theme-check` : aucune anomalie réelle. Les 4 avertissements
  « OrphanedSnippet » sont des faux positifs — vérification faite, les 4
  snippets sont bien référencés depuis `layout/theme.liquid` et
  `blocks/ulveo-bundle-picker.liquid`.
- Rendu revérifié après les changements de couleur : sélecteur de lot et
  sections du bas inchangés en géométrie, aucun débordement.
