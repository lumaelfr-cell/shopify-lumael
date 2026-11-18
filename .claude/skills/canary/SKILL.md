---
name: canary
description: Détecteur de dérive de contexte — vérifie si Claude a "perdu le fil". À invoquer via /canary, ou quand l'utilisateur dit "canary", "t'as perdu le fil ?", "check contexte", "où on en est vraiment ?", "tu suis encore ?". Force un point de contrôle strict : Claude restitue DE MÉMOIRE l'objectif, les décisions verrouillées, les contraintes/règles données par l'utilisateur, l'état réel et la prochaine étape, puis s'auto-audite et signale toute contradiction, rabâchage ou oubli. Permet de repérer en un coup d'œil quand Claude dérive.
---

# Canary — point de contrôle de contexte

But : laisser l'utilisateur **voir immédiatement** si tu as gardé le fil. Quand ce skill est invoqué, produis un CHECKPOINT concis et **honnête**, **de mémoire** (NE relis PAS des dizaines de fichiers pour tricher — on teste ta mémoire de travail actuelle).

Réponds EXACTEMENT dans ce format, rien d'autre :

🟦 **CANARY — checkpoint**
- **Objectif** (1 phrase) : le but réel de la tâche/session en cours.
- **Décisions verrouillées** : 2 à 4 décisions déjà actées, dans l'ordre.
- **Règles données par l'utilisateur** : ses consignes explicites (préférences, interdits, façon de bosser).
- **État réel** : ce qui est fait / ce qui marche / ce qui ne marche pas — **sans enjoliver**.
- **Prochaine étape** : la seule prochaine action.
- **Auto-audit** : signale toute **contradiction** avec ce qui précède, toute **hypothèse non vérifiée**, toute idée déjà tranchée que tu serais en train de rabâcher, et tout point où tu n'es **plus sûr**.

## Règles de fonctionnement
- Sois **bref**. Aucune flatterie, aucun remplissage.
- **Honnêteté > confort** : mieux vaut écrire « ⚠️ fil perdu sur X — je ne suis plus sûr » que d'inventer une restitution plausible.
- Si tu détectes une dérive (tu te contredis, tu rabâches, tu n'es plus sûr de l'objectif, tu as oublié une règle de l'utilisateur), commence la réponse par :
  > ⚠️ **DÉRIVE DÉTECTÉE** — voici où.
- Si tout est cohérent, termine par : `✅ fil tenu`.
- Ce skill ne modifie rien et ne lance aucune action : c'est un miroir, pas une tâche.
