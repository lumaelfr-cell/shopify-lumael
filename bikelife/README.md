# Bike Life: Street Kings

Jeu 3D de **bike life / wheeling** en monde ouvert, jouable dans le navigateur sur **PC, iPhone et Android**.
Motos cross, supermotards, motos de stunt et scooters (modèles fictifs inspirés des catégories réelles),
physique de conduite maison (suspensions, transfert de masse, embrayage, wheeling/stoppie émergents),
ville procédurale avec trafic et piétons, cycle jour/nuit, météo, sons moteurs synthétisés,
garage de personnalisation, progression, défis, contre-la-montre avec fantôme et multijoueur réel via un serveur inclus.

> Tout le contenu (modèles 3D, textures, sons, musique) est **généré par le code** : aucune ressource externe,
> aucune marque ni logo déposé. Les noms (Aozora, Midori, Hinode, Kronos, Nordvik, Fiammo, Kiiro, Brava, Velox,
> Pegaso, Lionne, Gilardi, Sina) sont inventés.

---

## Lancer le jeu

Prérequis : **Node.js 18+** (testé avec Node 22).

```bash
cd bikelife
npm install
npm run dev          # développement : http://localhost:5173 (et l'adresse réseau affichée pour le téléphone)
```

Jouer sur téléphone : ouvrez l'adresse « Network » affichée par Vite (même Wi-Fi), tournez l'écran en paysage.
Sur iPhone/Android, « Ajouter à l'écran d'accueil » lance le jeu en plein écran (manifeste PWA fourni).

### Version compilée + multijoueur

```bash
npm run start        # compile (dist/) puis lance le serveur : jeu + multijoueur sur http://localhost:8787
# ou séparément :
npm run build
npm run server       # PORT=8787 par défaut (variable PORT pour changer)
```

Les amis sur le même réseau ouvrent `http://<IP-du-PC>:8787`, puis **Menu → Multijoueur → Se connecter**
(l'adresse `ws://<IP>:8787/ws` est préremplie). Si vous jouez via `npm run dev`, lancez aussi `npm run server`
dans un autre terminal : le client se connecte au port 8787.

### Tests

```bash
npm test             # tests unitaires (physique, collisions, progression/sauvegarde, synthèse audio)
npm run typecheck    # vérification TypeScript
npx tsx scripts/sim.ts aoz-az125 hold 1   # banc d'essai physique en ligne de commande
```

`scripts/sim.ts <moto> <scénario> [aide 0|1|2]` — scénarios : `launch`, `hold` (wheeling piloté),
`spull` (wheeling scooter), `brake`, `stoppie`, `ramp`, `curb`, `wall`, `turn`, `drift`.

Tests dans un vrai navigateur (Playwright + Chromium requis, jeu servi sur l'URL donnée) :

```bash
node scripts/play.mjs http://localhost:5173/ ./captures wheelie   # conduite + coup d'embrayage + freinage
node scripts/tour.mjs http://localhost:8787/ ./captures           # garage, nuit, pluie, spots, mise en page mobile
node scripts/light.mjs http://localhost:8787/ ./captures          # éclairage jour / pluie / nuit / crépuscule
```

`node scripts/build-artifact.mjs` (après `npm run build`) produit `dist-artifact/`, une variante de la page
sans en-tête HTML, prête à être hébergée comme page web autonome.

---

## Commandes

### Clavier (QWERTY et AZERTY — touches physiques)

| Action | Touche |
|---|---|
| Gaz (progressifs) | **W** (Z en AZERTY) |
| Frein avant | **S** |
| Frein arrière | **Espace** |
| Diriger | **A / D** (Q / D en AZERTY) ou **← →** |
| Pencher le corps avant / arrière | **↑ / ↓** |
| Embrayage / wheeling | **Maj** : tenir + gaz pour monter en régime, relâcher = coup d'embrayage |
| Saut (bunny hop) | **J** : maintenir pour charger, relâcher |
| Figure en l'air | **K** + direction (↑ Superman, ↓ Heel clicker, ← Nac-nac, → Can-can, rien = No hander) |
| Rapport + / − (boîte manuelle) | **E / Q** |
| Caméra suivante | **C** — clic-glisser souris pour regarder autour |
| Réapparaître | **R** |
| Pause | **Échap** ou **P** |
| Klaxon | **H** |
| Masquer l'aide | **F1** |

### Manette (mapping standard Xbox/PlayStation)

Gâchette droite = gaz · gauche = frein avant · **B/○** = frein arrière · stick gauche = direction + appui avant/arrière ·
**A/✕** = embrayage/wheeling · **X/□** = saut · **Y/△** = figure · **RB/LB** = rapports · stick droit = regard ·
**Select** = caméra · **Start** = pause · croix bas = réapparaître · croix haut = klaxon.

### Écran tactile

- **Joystick gauche** : direction (gauche/droite) et appui du pilote (haut = avant, bas = arrière, idéal pour doser le wheeling).
- **Gâchette GAZ** analogique (hauteur du doigt = ouverture), **FREIN AV**, **FREIN AR**.
- **WHEELIE** : sur une moto à vitesses, maintenir = embrayage tiré (le moteur monte en régime en mode Arcade),
  relâcher = coup d'embrayage ; sur un scooter = tirer sur le guidon. On peut glisser le pouce de WHEELIE vers GAZ.
- **SAUT**, **FIGURE** (s'illumine en l'air), caméra ◉, pause II, réapparaître ↺, rapports +/− en boîte manuelle.
- Paramètres → *Commandes tactiles* : taille, opacité, mode gaucher, **déplacement libre de chaque bouton**.

---

## Contenu

### Véhicules (38)

- **Motocross / enduro** : 2T 50/85/125/250 et 4T 250F/450F (Aozora AZ 125/250/250F/450F, Midori KR 85/125/250F,
  Hinode HR 125/250/HRF 450R, Kronos 125 XS/250 XS-F/450 XS-F, Nordvik NC 125/NF 450, Fiammo FX 50/125/250/FXF 250,
  Kiiro KZ 250/450, Brava BC 125/BC 450F/BX 50).
- **Supermotards** : Kronos 690 SMR, Nordvik 701 SM, Aozora WS 450 SM, Hinode HRF 450 SM, Fiammo XSM 125, Brava SMX 50.
- **Stunt** : Custom Wheelie 125 2T, Stunt 450R, Stunt 690 (barre de 12h, crash cage, frein arrière au guidon).
- **Scooters** : Sina Orbiter 50, Aozora Aerix 50 et Aerix 70 Kit, Velox Nitrox 50, Pegaso Zap 50, Lionne Speedstrike 50,
  Gilardi Sprinter 50/125.

Chaque véhicule a sa courbe de couple, sa boîte (ou son variateur CVT), sa masse, son centre de gravité,
ses suspensions, ses freins, ses pneus et son **son moteur synthétisé** (2T MX, 2T 50, 4T MX, gros mono, scooter 2T/4T).

### Physique de conduite

- Corps rigide dans le plan longitudinal (tangage) avec **suspensions avant/arrière** (ressort + amortissement +
  butée), contact roue-sol par **échantillonnage circulaire** (les roues montent les trottoirs et les rampes).
- **Wheeling et stoppie émergents** : forces motrices/de freinage appliquées aux points de contact, transfert de masse.
- **Moteur + embrayage** à capacité limitée : embrayage automatique au démarrage, **coup d'embrayage** manuel,
  boîte auto ou manuelle, variateur CVT pour les scooters, limiteur, frein moteur, patinage de la roue arrière.
- Dynamique latérale : inclinaison réaliste (tan φ = a/g), rayon limité par l'adhérence, **dérapages** (frein arrière
  bloqué, glisse de puissance), adhérence selon **surface** (bitume, béton, terre, herbe, sable…) × **pneu** × **pluie**.
- Air : rotation par le poids du pilote + effet gyroscopique (gaz = cabre, frein arrière = pique), whip.
- Chutes : looping, passage par-dessus le guidon, réception de travers, mur, voiture, figure non terminée.
  La moto et le pilote glissent/roulent, puis réapparition au dernier point sûr.
- **3 niveaux d'aide** au wheeling : Simulation, Normale, Arcade (défaut sur mobile).

### Monde ouvert

Ville procédurale de ~1,1 km de côté (12×12 blocs) + périphérie : centre-ville et gratte-ciel, ruelles avec graffitis,
quartiers commerçants avec enseignes, résidentiel (maisons, haies), **la Cité** (barres d'immeubles), zone industrielle
(entrepôts, quai de chargement, conteneurs, silos), centre commercial, parc, place avec **parking souterrain**,
**parking à 4 niveaux** avec rampes, grand rond-point central, **Stunt Park** (kickers, grand saut, funbox, spine,
quarter-pipes, table, muret), **zone d'entraînement** (cercles, slalom, lignes de distance), **MX Park** (tables, doubles,
whoops, step-up, gros saut), **route de la Corniche** (~900 m de ligne droite) et périphérique.
Trafic IA (voies à droite, feux tricolores, rond-point, distances de sécurité, klaxons), piétons qui s'écartent,
cycle **jour/nuit** (éclairage public, fenêtres allumées, phare / rampe LED avant), **météo** (dégagé, nuageux, pluie avec route mouillée
et adhérence réduite, brouillard). Pas d'écran de chargement en jeu : téléportation instantanée depuis la carte.

### Caméras

Poursuite, rapprochée (course), vue pilote (casque masqué), cinématique (plans fixes en bord de route),
**caméra wheeling** latérale (automatique après 1,5 s de wheeling, désactivable). Collision caméra/décor.

### Figures et score

Wheeling (distance, durée, angle, vitesse ; **12h**, **circle wheeling**), stoppie, sauts (temps de vol, distance,
hauteur), figures freestyle (No Hander, Superman, Nac Nac, Heel Clicker, Can Can), whip, back/frontflip, dérapage,
burn, frottement de barre de 12h, **frôlements** de voitures. Combos avec multiplicateur, perte du combo à la chute.

### Progression

Argent et XP gagnés par les combos, défis, objectifs quotidiens (3 par jour) et succès (18) ; niveaux (bonus à chaque
niveau), **garage qui s'agrandit** tous les 2 niveaux, achat/vente de véhicules, **essai 90 s** avant achat,
records globaux et par moto, sauvegarde automatique locale (export/import possible).

### Garage et personnalisation

Studio 3D (plateau, néons, reflets) avec orbite souris/tactile. Couleurs (plastiques, secondaire, accent, cadre, jantes,
guidon, selle, plaques), 9 kits déco, numéro de plaque, plastiques (origine/Race/Rétro/Stunt), jantes (rayons, larges,
bâtons), pneus (crampons/mixte/route/slick — effet réel sur l'adhérence), guidons, selles, échappements (son + puissance),
garde-boue, suspensions (raideur/hauteur), moteur (stages 1-3), démultiplication, freins, barre de 12h, crash cage.
**Aperçu immédiat** sur le modèle 3D, achat en un clic, **configurations enregistrées** par moto, tenues enregistrées.

Pilote : casque (cross/intégral/jet) et déco, masque/visière/cagoule, maillot/hoodie/doudoune/coupe-vent/t-shirt et motifs,
numéro dorsal, pantalon MX/jean/jogging, gants, bottes MX/sneakers, sac à dos, teint. Le pilote est positionné par
**cinématique inverse** : mains sur les poignées (qui tournent avec le guidon), pieds sur les repose-pieds/plancher,
pied posé à l'arrêt, poses dédiées aux figures.

### Modes

Balade libre (colonnes lumineuses roses = défis disponibles sur place : s'y arrêter puis Entrée / bouton) ·
Mode wheeling (Boulevard / Corniche) · Session stunt 2 min · **16 défis** à médailles ·
**3 contre-la-montre** avec fantôme du meilleur temps · Garage · **Multijoueur** (serveur WebSocket inclus,
salons, chat, exploits partagés, interpolation des autres joueurs).

### Sons

Moteurs synthétisés en temps réel (AudioWorklet) : train d'impulsions de combustion à la fréquence d'allumage
(2T = 1/tour, 4T = 1/2 tours), résonances d'échappement fixes, ligne à retard (pot de détente), saturation,
ratés au ralenti 2T, pétarades 4T, sifflement de courroie des scooters, échappement plus fort selon la pièce montée.
Pneus (crissement bitume / projection terre), vent, ambiance urbaine, pluie, réceptions, chutes, klaxons, interface,
et **musique originale procédurale** (trap, boom bap, drill) désactivable.

---

## Architecture

```
bikelife/
  index.html, public/          page, manifeste PWA, icône
  server/server.mjs            serveur statique + relais multijoueur WebSocket
  scripts/                     banc d'essai physique, tests navigateur (Playwright), captures
  tests/                       tests unitaires Vitest
  src/
    main.ts, game.ts           entrée et orchestrateur (états, boucle, liaison des systèmes)
    core/                      maths, bus d'événements, entrées (clavier/manette/tactile)
    data/                      catalogue véhicules, pièces, tenues, défis
    physics/                   collisions (sol/murs/rampes), moteur+embrayage, simulation moto
    vehicle/                   modèles 3D procéduraux (motos, scooters), pilote IK, entité moto, matériaux
    world/                     plan, génération de la ville, textures, ciel/météo, trafic, piétons
    camera/                    caméras
    audio/                     synthèse moteur (DSP + AudioWorklet), gestionnaire audio, musique
    fx/                        particules (fumée, poussière, étincelles) et traces de pneus
    gameplay/                  progression/sauvegarde, figures/score, modes
    ui/                        HUD, menus, garage, commandes tactiles, styles
    net/                       client multijoueur
```

### Étendre le jeu

- **Nouvelle moto** : ajouter une entrée dans `src/data/bikes.ts` via `mx()`, `sm()` ou `scooter()` (les valeurs par
  défaut de la catégorie sont reprises ; surchargez couple, rapports, masse, couleurs…). Le modèle 3D, la physique, le son
  et le garage s'adaptent automatiquement.
- **Nouvelle pièce** : ajouter une option dans `PART_SLOTS` (`src/data/parts.ts`) et son effet dans `tuningFromConfig`
  et/ou `buildBikeVisual`.
- **Nouvelle tenue** : `src/data/apparel.ts` + rendu dans `src/vehicle/rider.ts`.
- **Nouveau défi / contre-la-montre** : `src/data/challenges.ts` (métrique, seuils, portes).
- **Nouvelle zone** : `src/world/layout.ts` (quartiers, lieux) et une méthode de construction dans `src/world/city.ts`
  (géométries fusionnées + colliders `addBox`/`addCylinder`/`addProfile`).

---

## État d'avancement (honnête)

**Terminé et testé** : tout ce qui est décrit ci-dessus fonctionne dans le navigateur (testé dans Chromium avec rendu
logiciel, scénarios automatisés de conduite/wheeling, garage, nuit, pluie, spots, mise en page mobile) ;
22 tests automatisés (physique, collisions, progression/sauvegarde, synthèse audio, serveur multijoueur).

**Limites connues / à développer** :
- Modèles 3D **procéduraux** (pas de modèles photoréalistes sous licence) : bonne silhouette et détails mécaniques
  (rayons, disques, fourche, chaîne, amortisseur, pots), mais pas le niveau d'un jeu AAA.
- Physique latérale simplifiée (modèle cinématique d'inclinaison, pas de dynamique de contre-braquage complète).
- Le pilote n'a pas de vrai ragdoll articulé : en chute, il tombe d'un bloc et roule.
- Piétons et voitures simplifiés (pas d'animations détaillées ; les voitures peuvent se chevaucher dans un carrefour).
- Pas de virages relevés (berms) au MX Park, pas de relief naturel (ville plate hors rampes et parkings).
- Les performances n'ont pas pu être mesurées sur de vrais téléphones dans cet environnement : 3 niveaux de qualité
  (basse/moyenne/haute) ajustent résolution, ombres, distance de vue, trafic et particules.
- Multijoueur : nécessite de lancer `server/server.mjs` (aucun serveur public fourni) ; pas de collisions entre joueurs
  ni de modes compétitifs en ligne pour l'instant.
- Musique et sons entièrement synthétisés (pas d'enregistrements réels).
