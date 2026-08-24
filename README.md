# Bundle Picker — « Pick Your Bundle & Save More »

Réplique du bloc bundle des captures (MAGSEAL / lidoxa) en section Shopify
autonome, avec bouton **Add to cart** fonctionnel (Cart AJAX API).

```
assets/bundle-picker.css                    styles (source unique preview + thème)
assets/bundle-picker.js                     sélection, résolution des variantes, panier
sections/bundle-picker.liquid               la section (schema + presets)
snippets/bundle-picker-payment-icons.liquid logos de paiement, en SVG inline
preview/index.html                          maquette statique pour vérifier le rendu
```

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

Le produit a trois options — Modèle, Couleur, Gravure. Configuration qui reproduit
les captures :

| Bloc | Quantité | Options imposées | Bandeau |
|---|---|---|---|
| Standard Edition | 1 | `Modèle:Standard` | — |
| Pro Edition | 1 | `Modèle:Pro` | MOST POPULAR |
| Duo Pack | 2 | `Modèle:Standard` | BEST VALUE |

Les menus restants (Couleur, Gravure) s'affichent alors par exemplaire, comme
« Color, Model » dans les captures.

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
