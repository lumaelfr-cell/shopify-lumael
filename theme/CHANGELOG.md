# Thème Ulvéo — journal des modifications

Le dossier `theme/` contient les fichiers du thème Shopify que nous modifions,
au même chemin que dans le thème. Le premier commit est une copie exacte du
thème en ligne ; chaque commit suivant est une modification datée et motivée.

Les modifications sont d'abord poussées sur une **copie non publiée** du thème
(« Ulvéo — Audit CRO v1 (à prévisualiser) »), jamais directement sur le thème
en ligne. On publie après prévisualisation.

## 2026-10-08 — Audit CRO v1

| Zone | Avant | Après | Pourquoi |
|---|---|---|---|
| Barre d'annonce | « Bonne nouvelle : -30 % jusqu'au 30 septembre » | « Livraison offerte dès 39 € · Retour gratuit sous 14 jours » | Promo expirée et incohérente avec le prix barré affiché. Les deux promesses de remplacement sont vraies et lèvent les deux freins principaux. |
| Note sous le prix | 4,8 ★ (329 avis), saisie à la main | Masquée tant qu'aucune vraie source d'avis n'existe | Note sans base vérifiable : risque légal (pratique commerciale trompeuse) et perte de confiance si un visiteur s'en aperçoit. |
| Badge Pro | « Le plus choisi » | « Le plus polyvalent » | Affirmation invérifiable. |
| Carte Duo Pack | « Meilleure offre » + « + Livraison offerte » | « Idéal à offrir », sans promesse de livraison | Le Duo est vendu au prix exact de 2 appareils (aucune remise). Avec 2 Standard, le panier fait 35,90 € : sous le seuil de 39 €, la livraison est donc payante au paiement. |
| Accordéon « Expédition » | « Le délai dépend de votre adresse » | « Livraison et retours » : délais, seuil, frais, retour gratuit | Le délai de livraison est une information précontractuelle obligatoire, et l'absence de délai fait abandonner. |
| Accordéon « Fabrication » | Texte générique Shopify | Supprimé | Texte de modèle qui fait « boutique générique ». |
| Bandeau défilant | « … Coupe intégrée · Gravure personnalisée … » | « … Livraison offerte dès 39 € · Retour gratuit sous 14 jours … » | La gravure ne peut pas être commandée (aucune option « Gravure » sur le produit). La coupe intégrée n'existe que sur la Pro. |
| Section garantie | Mention sur les articles gravés | Titre et note centrés sur le retour gratuit | Le retour gratuit (déjà dans la politique) était invisible, alors que c'est un argument fort. |
| FAQ | « Comment fonctionne la gravure ? » | « Sous quel délai vais-je la recevoir ? » + « Standard ou Pro : laquelle choisir ? » | Remplace une option fantôme par les deux vraies questions avant achat. |
| « Vous aimerez aussi » | Section active | Masquée | Boutique à produit unique : section vide. |
| Pied de page | Groupe vide | Menu « Informations » (menu `footer`) | Rendre l'aide, la livraison, les retours et les mentions faciles à trouver. |
| Pop-up | Après 2 s, « Abonnez-vous », sans contrepartie | Après 25 s, code de livraison offerte (ULVEO20, déjà actif) | À 2 s, la pop-up masque le produit avant qu'il soit compris (surtout sur mobile). Une contrepartie réelle cible le frein principal : les frais de port. |
| Page avis | « Achat vérifié » sur tous les avis, 4,8/329 saisis à la main | Aucune mention « Achat vérifié », note calculée sur les avis affichés, avis en double désactivé | Aucune commande enregistrée : la mention « Achat vérifié » ne peut pas être exacte. |

### Modifié directement en production (données de la boutique, hors thème)

- **Description produit** (`content/product-description.html`) : retrait de
  « Vous économisez par rapport à deux achats séparés » (faux : le Duo est
  facturé au prix de deux unités) et de « dans un seul coffret » ; « Coupe
  intégrée » précisée « édition Pro » ; suppression des blocs « Trois gestes »
  et « Questions fréquentes », déjà présents dans les sections sous le produit.
- **Textes alternatifs** des 7 photos produit (ils étaient tous vides).
- **Page FAQ** : lien cassé `/pages/suivre-ma-commande` remplacé par
  `/apps/parcelpanel` (le même lien que le menu) ; délai de livraison et retour
  gratuit précisés.
- **Menu principal** : « Catalogue » (collection d'un seul produit) devient
  « La scelleuse » (fiche produit directe) ; ajout de « Aide et FAQ ».
- **Menu du pied de page** : FAQ, Livraison, Retours, Notre histoire, Contact.
  Ce menu ne s'affiche que dans le thème « Audit CRO v1 ».

## 2026-10-18 — Prix v2 : livraison moins chère, prix produit ajustés

| | Avant | Après |
|---|---|---|
| Standard | 17,95 € (barré 30,95 €) | 19,90 €, sans prix barré |
| Pro | 22,95 € (barré 38,95 €) | 24,90 €, sans prix barré |
| Variante Duo Pack (non vendue telle quelle) | 39,90 € (barré 56,90 €) | 39,80 € = 2 × Standard, sans prix barré |
| Livraison standard | 7,99 € | 4,90 €, offerte dès 39 € (inchangé) |

Cohérence : deux Standard font 39,80 € ≥ 39 €, donc tout Duo est livré
gratuitement ; la carte Duo retrouve « + Livraison offerte », vraie cette fois.
Les prix barrés, jamais pratiqués, sont retirés (prix de référence
invérifiable). Thème : accordéon « Livraison et retours » passé à 4,90 €.
Hors thème : tableau de prix de la description produit, page Livraison
(champ « [10,00€] » et avertissement retirés).
