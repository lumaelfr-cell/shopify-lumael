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
- le nom du réglage **« Menu Modèle »** (`Modèle`) rend un menu virtuel dont les
  valeurs viennent de **« Menu Modèle — valeurs »** (`Standard, Pro`). Ce menu
  n'existe pas comme variante : il n'apparaît que sur les cartes à plusieurs
  exemplaires et voyage en propriété de ligne.

Le Duo Pack propose donc deux couleurs et deux modèles tout en restant une seule
variante vendue, au prix du pack.

Pour revenir aux deux menus de la référence (`Couleur, Modèle`), retirer
`Gravure` du réglage « Options par exemplaire ».
