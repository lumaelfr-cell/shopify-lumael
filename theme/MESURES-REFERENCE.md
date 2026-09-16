# Mesures relevées sur la photo de référence (stynlux)

Image source : 918 x 1987 px. Viewport web ≈ y=222 → y=1640 (1418 px) pour ~600 px CSS
=> facteur d'échelle ≈ 2.34 (918 / 393 pt de large)

| Élément                | px image      | px CSS (÷2.34) |
|------------------------|---------------|----------------|
| Carte : largeur        | 904           | 386            |
| Carte : hauteur        | 825           | 353            |
| Carte : marge latérale | ~8            | ~4  -> 10 retenu|
| Padding haut           | 94            | 40             |
| Padding bas            | 79            | 34             |
| Padding latéral        | 67            | 28             |
| Largeur contenu        | 770           | 329 (=386-2*28)|
| Titre font-size        | 58            | 26  (700)      |
| Sous-titre font-size   | 36            | 16  (1.35)     |
| Gap titre -> sous-titre| ~14           | 6              |
| Gap sous-titre -> champ| 82            | 35 -> 34       |
| Champ : hauteur        | 112           | 48             |
| Gap champ -> champ     | 30            | 13 -> 12       |
| Gap champ -> bouton    | 28            | 12             |
| Bouton : hauteur       | 110           | 48             |
| Rayon champs / bouton  | 16            | 7   -> 8 (= thème)|
| Rayon carte            | ~34           | ~14 -> 16      |
| Croix : glyphe         | 38            | 16             |
| Croix : depuis le haut | 69            | 29.5           |
| Croix : depuis droite  | 60            | 25.6           |

Vérification du centrage vertical :
  centre carte = (512+1337)/2 = 924.5
  centre viewport = (222+1640)/2 = 931
  => écart 6.5 px image (2.8 px CSS) -> la carte est CENTRÉE verticalement.
  Horizontalement : marges gauche/droite égales -> CENTRÉE.

Overlay : les couleurs du bandeau doré et du header rose sont IDENTIQUES
entre la photo 1 (popup ouvert) et la photo 2 (popup fermé).
=> la référence n'a AUCUN voile sombre.
