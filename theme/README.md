# Thème Ulvéo — fichiers suivis

Copie versionnée des fichiers du thème Shopify que nous modifions. Le thème
publié est « Ulvéo — sélecteur d'édition » ; les écritures automatisées sont
refusées sur un thème publié, donc les changements sont d'abord poussés sur
« Copie de Ulvéo — sélecteur d'édition » (non publié), puis reportés sur le
thème live depuis l'éditeur de code.

| Fichier | Rôle |
| --- | --- |
| `blocks/ulveo-bundle-picker.liquid` | Sélecteur d'édition : une carte par valeur de l'option Édition |
| `assets/bundle-picker.js` | Résolution des variantes et ajout au panier (Cart AJAX API) |
| `templates/product.json` | Réglages du bloc sur la page produit |

`assets/bundle-picker.css` n'est pas modifié et n'est donc pas suivi ici.

## Ligne d'options par exemplaire

Le réglage **« Options par exemplaire »** est une liste ordonnée de menus rendus
sur chaque ligne `#1`, `#2`… :

- un nom qui correspond à une option produit (`Couleur`, `Gravure`) rend un vrai
  menu de variante ;
- le nom du réglage **« Menu Modèle »** (`Modèle`) rend un menu dont les valeurs
  viennent de **« Menu Modèle — valeurs »** (`Standard, Pro`), c'est-à-dire les
  valeurs de l'option de palier vendues à l'unité.

Le menu Modèle se comporte différemment selon la carte :

| Carte | Exemplaires | Le menu Modèle… |
| --- | --- | --- |
| Standard | 1 | pilote l'option `Édition` : le prix et la photo de la carte suivent le choix |
| Pro | 1 | idem |
| Duo Pack | 2 | part en propriété de ligne — le pack se vend à son prix |

La règle est portée par `model_drives` dans le bloc : le menu pilote le palier
quand la carte vend un seul exemplaire **et** que sa valeur figure dans « Menu
Modèle — valeurs ». Un pack n'est jamais dans ce cas, donc le Duo Pack propose
deux couleurs et deux modèles en restant une seule variante vendue.

Pour revenir aux deux menus de la référence (`Couleur, Modèle`), retirer
`Gravure` du réglage « Options par exemplaire ».

## Prix et photo réactifs

Prix, prix barré et vignette de chaque carte sont repeints par
`BundlePicker.paint()` dès qu'un menu change, à partir de la variante que les
menus de la carte désignent. Le bloc expose pour cela `priceLabel`,
`compareLabel` et `image` par variante dans sa configuration JSON, plus une
`fallbackImage` (l'image mise en avant du produit) pour les variantes sans
photo.

Un prix saisi dans « Prix affiché » / « Prix barré » porte `data-bp-static` et
n'est jamais repeint : le réglage gagne sur la variante.
