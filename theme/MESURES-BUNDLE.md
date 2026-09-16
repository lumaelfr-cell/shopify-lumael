# Cotes relevées — sélecteur de lot (capture pullandgo)

Image 918 x 1987 px · viewport ~393 pt · facteur 2,336

| Élément                    | px image    | px CSS |
|----------------------------|-------------|--------|
| Carte : largeur            | 844         | 361 (= 393 - 2x16) |
| Carte : hauteur            | 210         | 90     |
| Carte : rayon              | ~28         | 12     |
| Carte : bordure sélect.    | ~5          | 2      |
| Carte : bordure normale    | ~2          | 1      |
| Écart entre cartes         | 50          | 21 -> 20 |
| Radio : diamètre           | 40          | 17 -> 18 |
| Radio : centre / bord g.   | 37          | 16     |
| Vignette : côté            | 115         | 49 -> 56 (boîte) |
| Vignettes 2 unités         | 160         | 68     |
| Vignettes 3 unités         | 170         | 73     |
| Titre « 1 Sac »            | 46          | 20 (700) |
| Titre : x / bord gauche    | 310         | 133    |
| Sous-ligne « Économise »   | 32          | 14     |
| Prix                       | 44          | 19 (700) |
| Prix barré                 | 32          | 14     |
| Badge : hauteur            | 40          | 17     |
| Badge : texte              | 24          | 10,5 (700) |
| CTA : hauteur              | 110         | 47 -> 48 |
| CTA : rayon                | ~28         | 12     |

Contrôle de la colonne de gauche :
  14 (padding) + 18 (radio) + 24 (gap) + 56 (vignette) + 20 (gap) = 132
  relevé : 133  -> cohérent.

Contrôle de la hauteur :
  12 (pad haut) + 56 (vignette) + 12 (pad bas) = 80
  la carte fait 90 -> padding vertical 17 ; retenu 16 -> 88 px.
