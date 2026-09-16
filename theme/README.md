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
