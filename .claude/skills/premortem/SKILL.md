---
name: premortem
description: "Premortem — projette le projet 6 mois dans le futur en ÉCHEC et remonte les causes. À invoquer via /premortem <projet ou décision>, ou quand l'utilisateur dit « premortem », « pourquoi ça va rater », « stress-test avant lancement ». Force l'IA à sortir du biais optimiste : elle écrit le récit de l'échec, identifie les causes classées par probabilité×impact, les signaux avant-coureurs mesurables, et les parades actionnables. Complémentaire de /council (débat) : premortem = autopsie anticipée."
---

# Premortem — l'autopsie AVANT la mort

Technique (Gary Klein, popularisée par Kahneman) : au lieu de demander « quels sont les risques ? » (réponses molles), on **postule que le projet A DÉJÀ ÉCHOUÉ** et on explique pourquoi. Le cerveau — et l'IA — trouve des causes bien plus concrètes en mode rétrospectif qu'en mode prospectif.

## Protocole strict

**Étape 0 — Contexte réel.** Avant d'écrire quoi que ce soit : lire l'état réel du projet (le `_brain/` s'il existe, le repo, les métriques connues). Un premortem sur des suppositions ne vaut rien. Si le projet n'est pas clair, poser UNE question de cadrage (objectif + horizon + définition du succès), pas plus.

**Étape 1 — Le décès.** Se placer 6 mois après le lancement (ou l'horizon donné). Écrire en 3-5 phrases le constat d'échec, au passé, factuel et froid. Pas « le projet pourrait avoir des difficultés » — « le projet est mort, voilà l'état du corps ».

**Étape 2 — Les causes.** Lister 6 à 10 causes de mort, chacune :
- au passé (« personne n'a trouvé le site parce que… »), concrète, spécifique à CE projet — zéro générique du type « manque de motivation » ;
- notée **probabilité (H/M/B) × impact (H/M/B)** ;
- avec la catégorie : produit / distribution / technique / humain (énergie, temps, santé) / externe (marché, plateforme, légal).
Chercher notamment les causes que l'optimisme cache : dépendance à une seule personne, à une seule plateforme, métrique de vanité prise pour de la traction, coût d'entretien sous-estimé, deadline émotionnelle.

**Étape 3 — Les signaux avant-coureurs.** Pour chaque cause H×H et H×M : quel signal MESURABLE l'annoncerait, et à quelle date le vérifier. (« Si à J+30 la rétention D7 < X % → la cause n°2 est en train de se réaliser. »)

**Étape 4 — Les parades.** Pour les 3-5 causes dominantes seulement : l'action préventive la plus petite qui la neutralise ou la teste tôt. Actionnable cette semaine, pas « faire du marketing ».

**Étape 5 — Verdict.** Terminer par : les 3 causes qui tueraient vraiment le projet, la confiance globale (X/10) que le projet atteigne son objectif en l'état, et LA prochaine action.

## Règles dures
- **Anti-complaisance** : interdiction de conclure « mais globalement c'est bien parti ». Le livrable est le rapport d'échec, pas un encouragement.
- **Sourcé** : si une cause repose sur un fait externe (règle d'une plateforme, taille de marché), le vérifier (WebSearch) au lieu de l'affirmer.
- **Spécifique** : chaque cause doit citer un élément réel du projet (une feature, un choix, une dépendance nommée).
- Format : markdown compact, tableaux pour les causes, pas de blabla.
