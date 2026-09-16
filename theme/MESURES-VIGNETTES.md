# Cotes relevées — bande de vignettes produit (capture pullandgo)

Même facteur que les relevés précédents : 2,336

| Élément                      | px image | px CSS |
|------------------------------|----------|--------|
| Bande : largeur totale       | 847      | 363 (= largeur des cartes, 361) |
| Vignette : largeur           | 205      | 87,7   |
| Vignette : hauteur           | 215      | 92     |
| Écart entre vignettes        | 10       | 4,3    |
| Rayon                        | ~20      | 8,5 -> 8 (= réglage actuel) |
| Espace image principale -> bande | 25   | 11 -> 12 |

Contrôle : 4 x 87,7 + 3 x 4,3 = 363,7  ~ 363 relevé. Cohérent.

Ratio de la vignette : 205/215 = 0,95, soit quasi carré.
Le réglage `aspect_ratio` du thème vaut déjà "1" (carré).

La 3e vignette porte un contour sombre : c'est l'image affichée.
Le produit Ulvéo compte 7 images -> 4 visibles, les suivantes au défilement,
exactement comme la référence.
