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
