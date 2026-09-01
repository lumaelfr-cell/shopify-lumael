# Vidéo ASMR Produit — Boîtier LED portable

Aucune vidéo n'a été générée pour l'instant. Artlist indique
actuellement **0 génération gratuite restante et aucun plan de
crédits actif**, il s'agit donc d'un script + de prompts prêts à
l'emploi : à générer une fois des crédits disponibles (voir « Notes de
génération » ci-dessous).

## Référence produit (reconstituée à partir de la description)

La photo d'origine n'a pas pu être téléversée (collée directement dans
le message, sans fichier/URL accessible), le produit est donc décrit
ici pour permettre à un générateur d'images de recréer une image de
référence proche :

- Boîtier compact de type clapet (clamshell), à peu près de la taille
  d'une paume de main, forme rectangulaire aux coins arrondis.
- **Couvercle (partie haute) :** bleu marine profond, finition brillante
  très réfléchissante. Près de la charnière, une petite fenêtre
  rectangulaire encastrée abrite un afficheur LED numérique (chiffres
  segmentés façon horloge, affichant actuellement « 00 ») juste à côté
  d'une petite icône scintillante/diamant à quatre pointes.
- **Base (partie basse) :** noir mat, empreinte légèrement plus grande
  que le couvercle, finition douce au toucher, contraste avec le haut
  brillant.
- **Bord avant de la base :** un bouton unique, circulaire et encastré
  (marche/fonction), avec un port USB-C juste à côté.
- Esthétique générale : gadget tech bicolore minimaliste, sensation
  premium/discrète, posé sur un fond gris clair uni sans coutures sur
  la photo de référence.

### Prompt image de référence (texte vers image)

Les prompts de génération sont volontiers laissés en anglais ci-dessous :
les modèles d'image/vidéo (Artlist, Midjourney, Kling, Veo, etc.)
donnent des résultats nettement plus fiables et précis avec des prompts
rédigés en anglais.

```
Studio product photo of a compact two-tone clamshell case, palm-sized,
rounded rectangular body. Top lid glossy deep navy-blue with a small
rectangular cutout showing a digital LED display reading "00" next to a
tiny sparkle icon. Bottom half matte black, slightly wider than the lid,
soft-touch finish. Front edge has one recessed circular button and a
USB-C port beside it. Shot on seamless light-grey background, soft
diffused studio lighting, 45-degree hero angle, sharp macro detail on
seams and finish contrast, no text or logo, no hands, ultra-realistic
product photography, 4k.
```

## Concept

ASMR pur, sans dialogue, sans voix off, sans musique — uniquement les
sons tactiles propres au produit (clics, tapotements, contact sur
surface lisse, léger ronronnement mécanique), captés/générés en gros
plan sonore et au ralenti. Durée totale visée : **18 à 24 secondes**,
montée en boucle pour Reels/TikTok/lecture automatique en fiche
produit Shopify.

## Découpage plan par plan

| # | Plan | Caméra | Action | Son |
|---|------|--------|--------|-----|
| 1 | Très gros plan, plongée | Fixe, lent zoom avant | Un doigt tapote deux fois le couvercle bleu marine brillant | Deux tapotements nets et résonnants |
| 2 | Macro, angle 3/4 | Lente rotation gauche-droite | Le couvercle s'ouvre sur sa charnière, légère résistance puis un clic doux en fin de course | Clic mécanique + léger relâchement de ressort |
| 3 | Gros plan sur la fenêtre d'affichage | Fixe, mise au point progressive | Les chiffres LED s'allument, « 00 » s'affiche, l'icône scintillante clignote une fois | Léger carillon électronique, ronronnement subtil |
| 4 | Macro sur le bord avant | Fixe | Un doigt appuie sur le bouton encastré ; clic tactile satisfaisant | Clic profond et étouffé |
| 5 | Très gros plan sur la jointure | Lent panoramique horizontal | Un ongle glisse le long de la ligne de jonction brillant/mat | Léger frottement, glissement quasi vitreux |
| 6 | Profil, angle bas | Lent recul de caméra | Le boîtier pivote légèrement en main, la lumière accroche le contraste brillant/mat | Ambiance sonore seule (quasi silence) |
| 7 | Plongée | Fixe, lent zoom avant | Le couvercle se referme, bruit sourd léger + clic façon aimant | Bruit sourd étouffé + clic |
| 8 | Plan produit final | Fixe, maintien 2 s | Le boîtier fermé repose, l'affichage s'éteint en fondu | Silence / ambiance, pour permettre une boucle |

## Prompt de génération unique et continu (image vers vidéo)

À utiliser une fois qu'une image de référence (issue du prompt
ci-dessus, ou la vraie photo produit) est disponible comme image
d'entrée :

```
Extreme macro ASMR product video of a two-tone navy-and-black clamshell
gadget case. Slow, deliberate camera moves: push-in, then slow orbit.
A single fingertip taps the glossy lid twice, then opens it with a soft
mechanical click; the LED display glows on inside the lid window. A
fingertip presses the recessed front button with a satisfying click.
Shallow depth of field, soft studio key light with subtle rim light
catching the glossy-to-matte transition. No hands beyond fingertips, no
face, no text overlays, no music — only close-mic'd tactile sounds:
taps, a mechanical click, a soft electronic chime, a muted closing
thud. Calm, slow pacing, satisfying ASMR tone, 4k, shallow depth of
field, seamless light-grey background.
```

Si le modèle choisi limite la durée d'un clip en dessous des 18-24
secondes visées, découper le tableau de plans en 2-3 générations (par
exemple plans 1-3, 4-6, 7-8) et les assembler au montage : chaque ligne
ci-dessus constitue déjà une séquence autonome.

## Notes de génération (une fois les crédits disponibles)

- **Image de référence :** `generate_image` (texte vers image) avec le
  prompt ci-dessus, ou téléversement de la vraie photo produit via une
  URL publique dès qu'elle en aura une.
- **Vidéo :** `generate_video` avec `input: { assetId }` pointant vers
  l'image de référence, sur un modèle image-vers-vidéo avec audio natif
  si les bruitages tactiles doivent être intégrés directement (par
  exemple une variante Veo 3.1 « with audio » ou Kling « audio on ») ;
  sinon générer en silence et ajouter les bruitages en post-production.
- **Durée :** demander la durée disponible la plus proche de 18-24 s,
  ou générer les 2-3 segments plus courts décrits ci-dessus puis les
  assembler.
- Vérifier `get_generation_cost` avant de lancer la génération, et
  revérifier `get_balance` au préalable — ce compte affiche
  actuellement 0 génération gratuite restante et aucun plan de
  crédits.

## Légende / accroche suggérée

> Le clic auquel vous ne vous attendiez pas. 🖤

Accroche courte, sans avalanche de hashtags ; laisser le son ASMR
porter la publication.
