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

## Options communes au pack

Une option ne peut pas être choisie appareil par appareil sur un pack : le pack
se vend à travers **une seule variante**, donc une seule valeur par option. La
gravure du 2e appareil ne pouvait donc pas être facturée.

Le réglage **« Options communes au pack »** (`Gravure`) sort ces options des
lignes `#1`, `#2`… sur les cartes à plusieurs exemplaires et les rend une seule
fois au-dessus, dans un bloc `data-bp-shared`. Le script les injecte dans la
résolution de chaque exemplaire, sans jamais les dupliquer en propriété de ligne
— elles sont déjà lisibles dans le titre de la variante.

Sur une carte à un exemplaire le réglage est sans effet : l'option reste dans la
ligne, via « Options par exemplaire ».

Rendu du Duo Pack :

```
Gravure
[Sans gravure (0€) ▾]          ← commun au pack, facturé une fois
Couleur, Modèle
#1  [Blanc ▾] [Pro ▾]
#2  [Bleu nuit ▾] [Standard ▾]
```

## Vendre chaque exemplaire séparément

Réglage `split_units`, **coché par défaut**. Sur une carte à plusieurs
exemplaires :

- chaque ligne `#1`, `#2`… résout sa propre variante — plus aucune n'est
  `data-bp-property-only` — et devient sa propre ligne de panier ;
- le menu Modèle de **chaque** ligne porte `data-bp-maps-to`, donc pilote
  l'option de palier ;
- le prix de la carte est la **somme** des exemplaires, calculée par
  `BundlePicker.paint()` ;
- « Options communes au pack » est sans effet : la gravure redevient un choix
  par appareil, facturé par appareil ;
- la variante du palier (`Édition = Duo Pack`) n'est plus vendue.

Décoché, on retrouve le pack vendu à travers la variante de son palier, à son
prix, avec les exemplaires suivants en propriétés de ligne.

### Le prix d'une somme

Aucune variante ne porte le montant d'un pack vendu à l'exemplaire, donc aucun
libellé rendu par Liquid ne convient. Le bloc expose `moneyFormat`
(`shop.money_format`) et `compareAt` en centimes par variante ; `formatMoney()`
reformate la somme côté script. Une carte à une seule variante garde le libellé
Liquid, au format exact de la boutique.

Le rendu initial est déjà juste : quand `split_pack` est vrai, le Liquid affiche
`prix du premier modèle × exemplaires`, ce que le script retrouve au chargement.

## Grille tarifaire

| Édition | Sans gravure | Avec gravure |
| --- | --- | --- |
| Standard | 17,95 € | 22,95 € |
| Pro | 22,95 € | 27,95 € |

La gravure vaut +5 € sur chaque appareil. Le Duo Pack n'a plus de prix propre :
il vaut la somme de ses deux appareils, de 35,90 € (2 × Standard) à 55,90 €
(2 × Pro gravés).

## Prix et photo réactifs

Prix, prix barré et vignette de chaque carte sont repeints par
`BundlePicker.paint()` dès qu'un menu change, à partir de la variante que les
menus de la carte désignent. Le bloc expose pour cela `priceLabel`,
`compareLabel` et `image` par variante dans sa configuration JSON, plus une
`fallbackImage` (l'image mise en avant du produit) pour les variantes sans
photo.

Un prix saisi dans « Prix affiché » / « Prix barré » porte `data-bp-static` et
n'est jamais repeint : le réglage gagne sur la variante.
