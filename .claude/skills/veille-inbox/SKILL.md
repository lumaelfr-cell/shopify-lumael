---
name: veille-inbox
description: "Vide la file de veille — lit les liens que Kenyann a collés dans la Station de veille, vérifie chacun À LA SOURCE, rend un verdict (à creuser / ferme à contenu / sans intérêt) et route ce qui est utile vers le cerveau du bon projet. À invoquer via /veille-inbox, ou quand il dit « trie ma veille », « y a du nouveau dans la station », « vide la file »."
---

# Vider la file de veille

**La file** : artifact `https://claude.ai/code/artifact/5cb0dd6f-0530-4e46-b7dd-0fa534425428`, collection `links`.
Un document = un lien. Champs : `url`, `note` (pourquoi il l'a gardé), `source`, `addedAt`, `status`, et `verdict` que TU écris.

## 1. Lire la file
`Artifact` action `read_db`, `db_op: "query"`, `collection: "links"`.
**À traiter = tout document sans champ `verdict`.** S'il n'y en a aucun, le dire en une ligne et s'arrêter — ne pas re-trier l'existant.

## 2. Récupérer le contenu réel — jamais juger sur l'URL
- **X / Twitter** : `curl -sL "https://api.fxtwitter.com/<user>/status/<id>"` → JSON avec `text`, `likes`, `views`, `author` (dont `followers`, `tweets`, `joined`). Fiable. ⚠️ Le navigateur intégré est **bloqué sur x.com** ; si le fil compte (les « N prompts » sont dans les réponses), passer par Chrome (`mcp__claude-in-chrome__*`) et dérouler.
- **GitHub** : `curl -sL "https://api.github.com/repos/<owner>/<repo>"` → **vraies** étoiles, licence, `pushed_at`, `owner.type`. Ne jamais reprendre les chiffres du thread.
- **YouTube** : skill `watch` si le contenu compte, sinon titre + description.
- **Reste** : `WebFetch`. Un site marchand : regarder aussi `/sitemap.xml` et `/mentions-legales` (éditeur, SIREN) — c'est souvent là qu'est l'info que la page d'accueil cache.
- ⛔ **Jamais de contenu payant.** Ce qui est derrière un compte ou marqué `Disallow` dans `robots.txt` ne se récupère pas, même si c'est techniquement accessible.

## 3. Trier

**Trois signaux de ferme à contenu** — un seul suffit à classer `farm` :
1. Le tweet principal **ne nomme pas** l'outil / le repo (la charge utile est dans les réponses) → hameçon.
2. « BREAKING », majuscules, promesse chiffrée (« en 30 min », « ÷71 », « 1,2 M$ ») sans source.
3. Compte à **> 20 posts/jour** (`tweets` ÷ âge du compte) → volume, pas veille.
Signal bonus : des réponses toutes en « Great share / Impressive / Amazing » depuis des comptes estampillés IA = pod d'engagement.

**MAIS — lire le contenu avant de conclure.** Une ferme relaie aussi du vrai (le Gaussian Splatting est arrivé comme ça). Le verdict porte sur **le fond**, jamais sur la tête du compte. Si le fond tient, c'est `keep` même si l'emballage est pourri.

**Les trois verdicts** :
- `keep` — **à creuser**. Réel, vérifié, et utile *à lui* (voir §4).
- `farm` — **ferme à contenu**. Recyclé, creux, ou promesse invérifiable.
- `skip` — **sans intérêt** : réel mais hors de sa stack, redondant avec ce qu'il a déjà, ou risqué (contournement de CGU, piratage → le dire franchement).

## 4. Le filtre « utile à Kenyann »
Il est **très au-dessus** du contenu IA grand public. Un guide « débuter avec Claude » ne lui sert à rien.

Ce qui compte pour lui :
- **3D temps réel** (Unity/WebGL/glTF/splatting) → V3D, P3D, R3D, GHS
- **Print / design-as-code / PDF / typo** → son angle mort du marché, fort différenciateur
- **Pipeline vidéo** (Remotion, ElevenLabs, montage) → LOG
- **Archi d'agents** (contexte, tokens, sous-agents, sécurité/injection) → transverse
- **Modding / jeu** → BG3, NERVE
- **Monétisation & économie des créateurs** → stratégie ≥ 1 k€/mois
Redondant chez lui, donc `skip` par défaut : prompt packs génériques, listes « meilleurs outils IA », automatisation business basique, deep-research (il a `/deep-research`).

## 5. Écrire le verdict
`Artifact` action `write_db`, `db_op: "update"`, `collection: "links"`, `doc_id: <id>` :
```json
{"status":"done","verdict":{"rating":"keep|farm|skip","summary":"<2-4 phrases, direct, ce qui est vrai et ce qui ne l'est pas>","routedTo":"<où c'est parti, ou vide>","at":"<ISO>"}}
```
Plus de 2 liens : un seul `db_op: "batch"` (≤ 50 écritures, une approbation).

## 6. Router ce qui vaut le coup
Un `keep` ne s'arrête pas au verdict — il part dans le cerveau du projet concerné :
`<PROJET>/_brain/Inbox/<date> — veille <sujet>.md` (ou `Research/` si c'est une piste longue).
La fiche dit : ce que c'est, **pourquoi ça le concerne lui**, les pièges vérifiés (licence, coût, perfs), et le prochain pas concret. Puis `git add` + `commit` + `push` ([[feedback_push_on_every_big_change]]).
⛔ Jamais dans `_brain/` autre chose qu'une fiche légère — pas d'archive lourde ([[feedback_never_bloat_the_brain]]).

## 7. Rendre compte
Un tableau : lien → verdict → où c'est parti. Puis **une ligne** sur ce qui mérite vraiment son attention. Ne pas paraphraser les fiches déjà écrites.

## Règles dures
- **Vérifier à la source, toujours.** Le scanner/thread REPÈRE, la source STATUE. Aucun chiffre repris sans l'avoir contrôlé.
- **Ne jamais inventer** une URL, un nombre d'étoiles, une licence ([[feedback_no_hallucinate_urls]]).
- Dire quand c'est invérifiable, plutôt que d'arrondir.
