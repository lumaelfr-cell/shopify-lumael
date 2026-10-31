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
| **Interagir** (porte, comptoir, pompe, objet…) / **descendre** à l'arrêt / **monter** près de la moto | **F** (appui long sur F = descendre quand une autre action est proposée) |
| Défis du lieu (marqueur rose) | **Entrée** |

**À pied** : **W A S D** ou flèches = marcher (relatif à la caméra), **Maj** = courir (endurance), **Espace** = sauter,
**F** = interagir, **C** = vue subjective / troisième personne, clic-glisser = tourner la caméra.

### Manette (mapping standard Xbox/PlayStation)

Gâchette droite = gaz · gauche = frein avant · **B/○** = frein arrière · stick gauche = direction + appui avant/arrière ·
**A/✕** = embrayage/wheeling · **X/□** = saut · **Y/△** = figure · **RB/LB** = rapports · stick droit = regard ·
**Select** = caméra · **Start** = pause · croix bas = réapparaître · croix haut = klaxon · **Y/△** à l'arrêt = interagir /
descendre / monter (maintenir = descendre) · croix gauche = défis du lieu. À pied : stick gauche = marcher, **B/○** ou
clic du stick = courir, **A/✕** = sauter, stick droit = caméra.

### Écran tactile

- **Joystick gauche** : direction (gauche/droite) et appui du pilote (haut = avant, bas = arrière, idéal pour doser le wheeling).
- **Gâchette GAZ** analogique (hauteur du doigt = ouverture), **FREIN AV**, **FREIN AR**.
- **WHEELIE** : sur une moto à vitesses, maintenir = embrayage tiré (le moteur monte en régime en mode Arcade),
  relâcher = coup d'embrayage ; sur un scooter = tirer sur le guidon. On peut glisser le pouce de WHEELIE vers GAZ.
- **SAUT**, **FIGURE** (s'illumine en l'air), caméra ◉, pause II, réapparaître ↺, rapports +/− en boîte manuelle.
- **ACTION** (apparaît quand une interaction est possible) ; l'invite à l'écran est aussi cliquable (OK / Descendre / Voir les défis).
- À pied : joystick = marcher (poussé à fond = courir), **SAUT**, **ACTION** ; glisser le doigt ailleurs = tourner la caméra.
- Paramètres → *Commandes tactiles* : taille, opacité, mode gaucher, **déplacement libre de chaque bouton**.

---

## Contenu

### Véhicules (49)

- **Motocross / enduro** : 2T 50/85/125/250 et 4T 250F/450F (Aozora AZ 125/250/250F/450F, Midori KR 85/125/250F,
  Hinode HR 125/250/HRF 450R, Kronos 125 XS/250 XS-F/450 XS-F, Nordvik NC 125/NF 450, Fiammo FX 50/125/250/FXF 250,
  Kiiro KZ 250/450, Brava BC 125/BC 450F/BX 50).
- **Supermotards** : Kronos 690 SMR, Nordvik 701 SM, Aozora WS 450 SM, Hinode HRF 450 SM, Fiammo XSM 125, Brava SMX 50.
- **Stunt** : Custom Wheelie 125 2T, Stunt 450R, Stunt 690 (barre de 12h, crash cage, frein arrière au guidon).
- **Scooters** : Sina Orbiter 50, Aozora Aerix 50 et Aerix 70 Kit, Velox Nitrox 50, Pegaso Zap 50, Lionne Speedstrike 50,
  Gilardi Sprinter 50/125, **maxi-scooter Aozora TX 560**.
- **Enduro / pit bike / 50 à boîte** : Cobalt SE 300 Factory, Vermeil RR 300 2T, Pitstar P125 (pit bike 14/12"), Rayo MRT 50.
- **Routières** : Aozora RZ 600 (sportive 4 cylindres carénée), MZ-07 (roadster bicylindre 270°), MZ-125.

**Identité visuelle par modèle** (`src/data/modelStyles.ts`) : chaque moto reprend les traits reconnaissables du modèle
réel de référence, sans logo : cadre aluminium double poutre (japonaises) ou acier peint (orange façon KTM, bleu façon
Husqvarna, rouge façon GasGas) avec cadre arrière composite, échappement à culasse inversée qui sort vers l'arrière
(YZ250F/YZ450F), **double silencieux selon l'année** (CRF450R 2017-2020, sélectionnable au garage), forme des écopes et
de la plaque avant par famille, phare pointu (690 SMC R), rond (701 Supermoto) ou d'enduro, couleurs de garde-boue,
de plaques et déco d'usine en aplats. Routières : carénage, bracelets, double disque, cadre périmétrique ; roadster :
guidon large, écopes, phare compact. Sons distincts : 4 cylindres, bicylindre calé à 270° (allumages irréguliers),
bicylindre 360°, gros mono, 2T, scooters.

Chaque véhicule a sa courbe de couple, sa boîte (ou son variateur CVT), sa masse, son centre de gravité,
ses suspensions, ses freins, ses pneus et son **son moteur synthétisé** (2T MX, 2T 50, 4T MX, gros mono, scooter 2T/4T).

### Dimensions réelles

Les noms et logos du jeu sont fictifs, mais **chaque véhicule reprend les cotes publiées du modèle réel dont il
s'inspire** (`src/data/realSpecs.ts`). Ces cotes pilotent directement le jeu :

- **empattement**, **hauteur de selle** et **garde au sol** → géométrie du modèle 3D, position du pilote,
  points de frottement (garde-boue, sabot, barre de 12h) et centre de gravité ;
- **dimensions de pneus** (ex. `80/100-21`) → rayon réel des roues (jante + flanc) et largeur des pneus ;
- **poids** (sec, sans carburant ou en ordre de marche) + **réservoir** (essence à 0,74 kg/L) → masse en jeu plein fait,
  inertie en tangage recalculée ;
- **débattements** et **angle de chasse** → suspensions et direction.

La fiche **« Dimensions réelles »** du garage (Mes véhicules / Concession) affiche ces valeurs ; celles marquées
**≈** sont estimées faute de donnée constructeur publiée. Les motos de stunt sont des préparations (roues 17",
suspensions abaissées) : leurs cotes sont estimées à partir de la moto d'origine. Les modèles réels ne sont cités
qu'à titre de référence technique ; le jeu n'est affilié à aucun constructeur. `npx tsx scripts/specs-table.ts`
affiche les valeurs appliquées (rayons de roues, centre de gravité…).

Empattement, selle et garde au sol en mm ; poids : o.m. = ordre de marche, s. carb. = sans carburant.

| Véhicule (jeu) | Cotes reprises de | Empatt. | Selle | Garde sol | Poids | Pneus AV / AR | Estimé |
|---|---|---|---|---|---|---|---|
| Aozora AZ 125 | Yamaha YZ125 (2024) | 1445 | 980 | 366 | 95 kg (o.m.) | 80/100-21 / 100/90-19 | — |
| Aozora AZ 250 | Yamaha YZ250 (2024) | 1486 | 975 | 361 | 103 kg (o.m.) | 80/100-21 / 110/90-19 | — |
| Aozora AZ 250F | Yamaha YZ250F (2024) | 1475 | 970 | 351 | 106 kg (o.m.) | 80/100-21 / 100/90-19 | — |
| Aozora AZ 450F | Yamaha YZ450F (2024) | 1480 | 965 | 351 | 109 kg (o.m.) | 80/100-21 / 120/80-19 | — |
| Midori KR 85 | Kawasaki KX85 (2024) | 1265 | 830 | 290 | 74,6 kg (o.m.) | 70/100-17 / 90/100-14 | débattements, chasse |
| Midori KR 125 | Kawasaki KX125 (2008) | 1460 | 945 | 375 | 87,5 kg (sec) | 80/100-21 / 100/90-19 | débattements, chasse |
| Midori KR 250F | Kawasaki KX250 (2024) | 1486 | 960 | 345 | 107,8 kg (o.m.) | 80/100-21 / 100/90-19 | — |
| Hinode HR 125 | Honda CR125R (2007) | 1471 | 947 | 351 | 89,4 kg (sec) | 80/100-21 / 100/90-19 | débattements, chasse |
| Hinode HR 250 | Honda CR250R (2007) | 1481 | 942 | 338 | 96,6 kg (sec) | 80/100-21 / 110/90-19 | débattements, chasse |
| Hinode HRF 450R | Honda CRF450R (2024) | 1481 | 965 | 335 | 113 kg (o.m.) | 80/100-21 / 120/80-19 | — |
| Kronos 125 XS | KTM 125 SX (2024) | 1485 | 958 | 359 | 92,4 kg (s. carb.) | 80/100-21 / 100/90-19 | — |
| Kronos 250 XS-F | KTM 250 SX-F (2024) | 1485 | 958 | 343 | 106,6 kg (o.m.) | 80/100-21 / 110/90-19 | — |
| Kronos 450 XS-F | KTM 450 SX-F (2024) | 1491 | 958 | 343 | 108 kg (o.m.) | 80/100-21 / 120/80-19 | — |
| Nordvik NC 125 | Husqvarna TC 125 (2024) | 1485 | 939 | 350 | 92,5 kg (s. carb.) | 80/100-21 / 100/90-19 | — |
| Nordvik NF 450 | Husqvarna FC 450 (2024) | 1485 | 939 | 336 | 102,8 kg (s. carb.) | 80/100-21 / 120/80-19 | — |
| Fiammo FX 50 | Fantic XE 50 Performance | 1435 | 870 | 300 | 94 kg (o.m.) | 80/90-21 / 110/80-18 | garde au sol, débattement arrière, chasse |
| Fiammo FX 125 | Fantic XX 125 (2024) | 1440 | 975 | 360 | 90 kg (sec) | 80/100-21 / 100/90-19 | garde au sol, réservoir, débattements, chasse |
| Fiammo FX 250 | Fantic XX 250 (2024) | 1485 | 970 | 360 | 98 kg (o.m.) | 80/100-21 / 110/90-19 | garde au sol, débattements, chasse |
| Fiammo FXF 250 | Fantic XXF 250 (2024) | 1475 | 970 | 350 | 105 kg (sec) | 80/100-21 / 100/90-19 | garde au sol, débattements, chasse |
| Kiiro KZ 250 | Suzuki RM-Z250 (2024) | 1485 | 955 | 330 | 106 kg (o.m.) | 80/100-21 / 100/90-19 | débattements |
| Kiiro KZ 450 | Suzuki RM-Z450 (2024) | 1480 | 960 | 330 | 112 kg (o.m.) | 80/100-21 / 120/80-19 | débattements |
| Brava BC 125 | GasGas MC 125 (2024) | 1485 | 950 | 350 | 87,5 kg (sec) | 80/100-21 / 100/90-19 | garde au sol |
| Brava BC 450F | GasGas MC 450F (2024) | 1485 | 956 | 354 | 103,3 kg (sec) | 80/100-21 / 120/80-19 | — |
| Brava BX 50 | Derbi Senda DRD X-Treme 50 R | 1413 | 890 | 300 | 105 kg (o.m.) | 90/90-21 / 120/80-18 | hauteur de selle, garde au sol, poids, pneus, débattements, chasse |
| Cobalt SE 300 Factory | Sherco 300 SE Factory (2024) | 1480 | 950 | 370 | 103 kg (sec) | 90/90-21 / 140/80-18 | garde au sol, poids, chasse |
| Vermeil RR 300 2T | Beta RR 300 2T (2024) | 1482 | 930 | 320 | 103,5 kg (sec) | 90/90-21 / 140/80-18 | poids, débattements, chasse |
| Pitstar P125 Pit | Pit bike 125 4T type YCF Pilot (roues 14/12") | 1150 | 790 | 300 | 68 kg (sec) | 60/100-14 / 80/100-12 | empattement, hauteur de selle, garde au sol, poids, réservoir, débattements, chasse |
| Rayo MRT 50 | Rieju MRT 50 (2021) | 1365 | 890 | 300 | 89 kg (sec) | 90/90-21 / 120/80-18 | empattement, hauteur de selle, garde au sol, poids, réservoir, débattements, chasse |
| Aozora RZ 600 | Yamaha YZF-R6 (2017-2020) | 1375 | 850 | 130 | 190 kg (o.m.) | 120/70-17 / 180/55-17 | — |
| Aozora MZ-07 | Yamaha MT-07 (2021) | 1400 | 805 | 140 | 184 kg (o.m.) | 120/70-17 / 180/55-17 | — |
| Aozora MZ-125 | Yamaha MT-125 (2020) | 1325 | 810 | 155 | 142 kg (o.m.) | 100/80-17 / 140/70-17 | garde au sol, débattement arrière, chasse |
| Kronos 690 SMR | KTM 690 SMC R (2023) | 1470 | 890 | 237 | 147 kg (sec) | 120/70-17 / 160/60-17 | — |
| Nordvik 701 SM | Husqvarna 701 Supermoto (2024) | 1470 | 890 | 238 | 147 kg (sec) | 120/70-17 / 160/60-17 | — |
| Aozora WS 450 SM | Yamaha WR450F (2024) | 1470 | 925 | 300 | 117 kg (o.m.) | 120/70-17 / 150/60-17 | hauteur de selle et garde au sol après passage en 17" |
| Hinode HRF 450 SM | Honda CRF450R (2024) | 1481 | 935 | 300 | 113 kg (o.m.) | 120/70-17 / 150/60-17 | hauteur de selle et garde au sol après passage en 17" |
| Fiammo XSM 125 | Fantic XMF 125 Competition | 1435 | 880 | 260 | 112 kg (sec) | 100/80-17 / 130/70-17 | garde au sol, réservoir, débattements, chasse |
| Brava SMX 50 | Derbi Senda DRD X-Treme 50 SM (2019) | 1413 | 865 | 240 | 105 kg (o.m.) | 100/80-17 / 130/70-17 | garde au sol, poids, pneus, débattements, chasse |
| Custom Wheelie 125 2T | Yamaha YZ125 (2024) | 1445 | 945 | 300 | 100 kg (o.m.) | 120/70-17 / 150/60-17 | cotes après préparation |
| Custom Stunt 450R | Honda CRF450R (2024) | 1481 | 920 | 290 | 120 kg (o.m.) | 120/70-17 / 160/60-17 | cotes après préparation |
| Custom Stunt 690 | KTM 690 SMC R (2023) | 1470 | 870 | 225 | 155 kg (sec) | 120/70-17 / 160/60-17 | cotes après préparation |
| Sina Orbiter 50 | SYM Orbit II 50 | 1310 | 805 | 120 | 99 kg (sec) | 120/70-12 / 130/70-12 | garde au sol, débattements, chasse |
| Aozora Aerix 50 | Yamaha Aerox 50 2T (2013-2017) | 1300 | 804 | 120 | 97 kg (sec) | 130/60-13 / 140/60-13 | empattement, garde au sol, débattements, chasse |
| Velox Nitrox 50 | MBK Nitro 50 2T (plateforme Aerox) | 1300 | 804 | 120 | 97 kg (sec) | 130/60-13 / 140/60-13 | empattement, garde au sol, débattements, chasse |
| Pegaso Zap 50 | Piaggio Zip 50 | 1230 | 770 | 110 | 85 kg (sec) | 100/80-10 / 120/70-10 | garde au sol, débattements, chasse |
| Lionne Speedstrike 50 | Peugeot Speedfight 4 50 2T | 1306 | 800 | 125 | 100 kg (sec) | 130/60-13 / 130/60-13 | garde au sol, réservoir, débattements, chasse |
| Gilardi Sprinter 50 | Gilera Runner 50 SP | 1300 | 830 | 125 | 105 kg (o.m.) | 120/70-12 / 130/70-12 | empattement, garde au sol, pneus, débattements, chasse |
| Gilardi Sprinter 125 | Gilera Runner 125 ST | 1340 | 815 | 130 | 137 kg (o.m.) | 120/70-14 / 140/60-13 | garde au sol, réservoir, débattements, chasse |
| Aozora TX 560 | Yamaha TMAX 560 (2022) | 1575 | 800 | 125 | 220 kg (o.m.) | 120/70-15 / 160/60-15 | garde au sol, chasse |
| Aozora Aerix 70 Kit | Yamaha Aerox 50 2T (kit 70 cm³) | 1300 | 804 | 120 | 99 kg (sec) | 130/60-13 / 140/60-13 | empattement, garde au sol, débattements, chasse |

Sources principales : fiches constructeur (Yamaha, Kawasaki, Honda, KTM, Fantic), 1000ps.com, motorcycle.com,
dirtrider.com, totalmotorcycle.com, 50factory.com, largus.fr, motorradundreisen.de, ultimatespecs.com.

### À pied, bâtiments visitables et commerces

- **Descendre / remonter** : à l'arrêt, F (ou Y, ou ACTION). Animation : pied au sol, jambe qui passe au-dessus de la
  selle. La moto reste **garée là où on l'a laissée** sur sa béquille (latérale pour les motards et routières, trépied
  de bord de piste pour les cross, béquille centrale pour les scooters). Moteur coupé quand on descend.
- **Personnage à pied** : marche, course (endurance), saut, escaliers et étages, s'asseoir (canapé, banc, chaise),
  dormir dans un lit (passe au matin, santé pleine), vue à la 3ᵉ personne (épaule) ou subjective, bruits de pas selon
  le sol. Collisions séparées : les piétons passent les portes, les motos sont arrêtées par les portes piétonnes.
- **9 bâtiments modélisés dans la ville, sans écran de chargement** (`src/world/buildings.ts`) :
  - *Garage Bike Life* (rideau métallique ouvrable, établi → personnalisation, **tes autres motos exposées** et
    prenables, salon, TV, frigo, interrupteur) ;
  - *Atelier moto* (accueil, mécanicien, ponts, outillage) : **réparation** payante si la moto est dans l'atelier,
    accès pièces / performances / peinture ;
  - *Concession* : motos exposées sur podiums, **borne pour changer de rayon** (toutes les motos du jeu), fiche avec
    cotes réelles, achat (livrée au garage), essai, configurateur ;
  - *MX Gear* : mur de casques, portants, bottes, sacs → achat et port immédiat (visible sur le personnage), cabine ;
  - *Station-service* : pompes (plein payé au litre), *Supérette 24/7* (rayons, frigos, caisse) ;
  - *Burger Street* : comptoir, cuisine, salle, tables où s'asseoir ;
  - *Résidence Les Tilleuls* : hall, **4 niveaux** reliés par l'escalier, 16 appartements meublés (portes, TV, lits,
    canapés, frigos), **toit accessible** ;
  - *Entrepôt abandonné* : on y entre à pied ou à moto, mezzanine, rampes de fortune, une trouvaille à fouiller ;
  - *Le Local (Bike Life)* : la bande (PNJ qui parlent et donnent des conseils), sono (change la musique), tableau
    des défis du quartier, motos des potes.
- **Portes fonctionnelles** : battantes (ouvrir/fermer), coulissantes automatiques des commerces, rideaux métalliques ;
  chaque porte fermée bloque le passage.
- **PNJ** animés (respiration, regard qui suit le joueur, gestes) avec dialogues et services.
- **Économie de la vie courante** : essence consommée selon la puissance délivrée (réservoir réel du modèle),
  réserve et panne sèche, jerrican, dépanneuse ; **état mécanique** (chutes et réceptions violentes : puissance réduite,
  guidon tordu, phare cassé) ; **santé du pilote** (chutes, voitures ; nourriture, repos, sommeil ; K.O. → soins payants) ;
  **sac** d'articles utilisables partout (pause → Sac).
- **Chute physique** : le pilote devient une poupée de chiffon articulée (15 points, os, frottement au sol), puis en
  balade il se relève et **remonte sur la moto** avec animation.

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

Nouveaux modules (jeu à pied et bâtiments) : `vehicle/walker.ts` (personnage à pied), `vehicle/poses.ts` (poses
debout / marche / course / assis / allongé), `vehicle/ragdoll.ts` (chute), `world/interiorKit.ts` (murs à ouvertures,
dalles et trémies, escaliers, portes animées, mobilier, PNJ, motos d'exposition), `world/buildings.ts` (les 9
bâtiments), `world/worldGeom.ts`, `ui/panel.ts` (commerces, dialogues, sac), `data/items.ts`, `data/modelStyles.ts`
(identité visuelle par modèle), `vehicle/roadModel.ts` (routières).

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
Les 49 véhicules, avec leurs cotes réelles, passent les scénarios automatisés (wheeling tenu, rampe, trottoir de 15 cm)
sans chute. `scripts/walk.mjs` teste dans Chromium le jeu à pied de bout en bout : descendre, marcher, murs, rideau
ouvert/fermé, établi → garage, concession (borne, fiche de vente), achat à la supérette, porte du fast-food, escalier
jusqu'au 1er étage, appartement, toit, remonter, consommation d'essence, chute en poupée de chiffon et remontée.

**Limites connues / à développer** :
- Modèles 3D **procéduraux** (pas de modèles photoréalistes sous licence) : bonne silhouette et détails mécaniques
  (rayons, disques, fourche, chaîne, amortisseur, pots), mais pas le niveau d'un jeu AAA.
- Physique latérale simplifiée (modèle cinématique d'inclinaison, pas de dynamique de contre-braquage complète).
- Poupée de chiffon simplifiée (pas de limites angulaires fines des articulations, pas de collision entre les membres).
- Piétons et voitures simplifiés (pas d'animations détaillées ; les voitures peuvent se chevaucher dans un carrefour).
- Pas de virages relevés (berms) au MX Park, pas de relief naturel (ville plate hors rampes et parkings).
- Les performances n'ont pas pu être mesurées sur de vrais téléphones dans cet environnement : 3 niveaux de qualité
  (basse/moyenne/haute) ajustent résolution, ombres, distance de vue, trafic et particules.
- Multijoueur : nécessite de lancer `server/server.mjs` (aucun serveur public fourni) ; pas de collisions entre joueurs
  ni de modes compétitifs en ligne pour l'instant.
- Musique et sons entièrement synthétisés (pas d'enregistrements réels).
- **Modèles 3D procéduraux, pas des reproductions exactes** : les motos reprennent les cotes réelles et les traits
  distinctifs listés plus haut, mais pas la forme exacte de chaque pièce ni les logos / graphismes officiels (marques
  déposées, non reproduites). Des modèles 3D sous licence du constructeur seraient nécessaires pour une copie fidèle.
- Bâtiments visitables : 9 (les autres immeubles de la ville restent des façades). Pas de centre commercial visitable
  ni de maisons ouvertes pour l'instant. Les PNJ des commerces ne se déplacent pas.
- Interactions entre joueurs en ligne : uniquement les motos (pas de joueurs à pied visibles en multijoueur).
- Dimensions réelles : certaines cotes (garde au sol de scooters, débattements, chasse, motos de stunt préparées)
  ne sont pas publiées et sont estimées (marquées ≈ dans le jeu). La forme des carénages reste générique.
