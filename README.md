# Bundle Picker — « Pick Your Bundle & Save More »

Réplique du bloc bundle des captures (MAGSEAL / lidoxa) en section Shopify
autonome, avec bouton **Add to cart** fonctionnel (Cart AJAX API).

```
assets/bundle-picker.css                    styles (source unique preview + thème)
assets/bundle-picker.js                     sélection, résolution des variantes, panier
blocks/bundle-picker.liquid                 bloc de thème (Horizon et dérivés)
blocks/ulveo-bundle-picker.liquid           même bloc, réglages hérités du thème Ulvéo
sections/bundle-picker.liquid               section classique (thèmes non-Horizon)
snippets/bundle-picker-payment-icons.liquid logos de paiement, en SVG inline
preview/index.html                          maquette statique pour vérifier le rendu
```

## Bloc ou section ?

- **Thèmes Horizon** (Horizon, Canyon…) : la page produit est une section
  `product-information` composée de blocs. Utiliser `blocks/bundle-picker.liquid`,
  qui s'insère dans la colonne d'informations produit à côté du prix et du titre.
- **Thèmes classiques** (Dawn et dérivés) : utiliser `sections/bundle-picker.liquid`.

Les deux partagent le même CSS, le même JS et le même rendu.

## État de l'installation sur la boutique Ulvéo

Installé dans le thème **« Ulvéo — sélecteur d'édition »** (non publié) :

| Fichier | État |
|---|---|
| `assets/bundle-picker.css` | envoyé |
| `assets/bundle-picker.js` | envoyé |
| `snippets/bundle-picker-payment-icons.liquid` | envoyé |
| `blocks/bundle-picker.liquid` | envoyé (disponible à l'ajout dans l'éditeur) |
| `blocks/ulveo-bundle-picker.liquid` | **remplacé** par la nouvelle implémentation |

Le modèle `templates/product.json` n'a pas été touché : il référençait déjà un bloc
`ulveo-bundle-picker`, dont le fichier porte désormais le nouveau design. Les
réglages déjà saisis (titre, arguments, descriptions, bandeaux) sont conservés ;
les nouveaux réglages prennent leurs valeurs par défaut.

Le réglage *Masquer le sélecteur et les boutons natifs* est activé par défaut,
puisque le bloc porte son propre bouton d'ajout au panier. Le décocher rétablit
le sélecteur de variantes et les boutons d'achat du thème.

## Vérifier le rendu

Ouvrir `preview/index.html` dans un navigateur (largeur ~430 px). Le contenu y est
celui des captures, le bouton simule l'ajout au panier.

## Installer dans le thème

1. Copier les 4 fichiers dans `assets/`, `sections/` et `snippets/` du thème
   (Boutique en ligne → Thèmes → … → Modifier le code).
2. Éditeur de thème → page produit → **Ajouter une section** → *Bundle picker*.
3. Réglages de la section : choisir le produit, le titre, le libellé du bouton,
   le message de stock, ce qui se passe après l'ajout (tiroir / panier / paiement).
4. Un bloc **Offre** par palier :
   - *Quantité* : 1 pour une édition simple, 2 pour le Duo Pack (deux lignes
     `#1` / `#2`, chacune avec ses propres options).
   - *Bandeau* : `MOST POPULAR`, `BEST VALUE`…
   - *Points forts* : une ligne = une puce ✔.
   - *Options imposées* : `Modèle:Pro` masque le menu « Modèle » sur cette carte
     et force la variante Pro.
   - *Bandeau bas de carte* : `+ Free shipping`.

### Réglage pour « Scelleuse de sachets magnétique Ulvéo »

Le produit a trois options : Édition (Standard / Pro / Duo Pack), Couleur
(Blanc / Bleu nuit) et Gravure. Le bloc crée une carte par valeur d'Édition et
affiche les menus Couleur et Gravure sous la carte sélectionnée.

Le Duo Pack est une valeur d'Édition, donc une seule variante à 40,90 € : la
carte montre bien deux lignes `#1` et `#2`, mais le panier reçoit une seule
ligne. La couleur du second appareil part en propriété de ligne (`#2 Couleur`)
et apparaît sur la commande. Le réglage *Options des exemplaires supplémentaires*
contrôle les menus proposés pour ce second appareil — Couleur uniquement par
défaut, pour ne pas offrir une gravure facturée 5 € en supplément.

## Prix des offres

L'ajout au panier crée de vraies lignes aux prix des variantes : Shopify facture
ces prix-là, pas le prix affiché sur la carte. Pour que le prix de l'offre soit
réellement appliqué :

1. Créer une réduction automatique ou un code (Réductions → Créer).
2. Renseigner ce code dans le champ *Code de réduction* du bloc.

Après l'ajout, le client est renvoyé sur `/discount/CODE?redirect=/cart`, le code
est appliqué au panier. Sans code, seul l'affichage change.

Chaque ligne reçoit les propriétés `_bundle` (nom de l'offre) et `_bundle_item`
(`#1`, `#2`) pour retrouver la composition dans le panier et la commande.

## Comportement du bouton

- Combinaison introuvable dans les variantes → bouton *Unavailable*, désactivé.
- Variante en rupture → bouton *Sold out*, désactivé.
- Sinon `POST /cart/add.js` avec une ligne par exemplaire, puis ouverture du
  tiroir de panier (`cart:refresh` / `cart:build` / `cart-drawer.open()`), ou
  redirection panier/paiement selon le réglage.
- Les erreurs de l'API panier sont affichées sous le bouton.
