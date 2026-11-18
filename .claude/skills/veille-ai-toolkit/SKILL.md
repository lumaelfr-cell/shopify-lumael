---
name: veille-ai-toolkit
description: Boîte à outils IA VÉRIFIÉE issue de la veille de l'utilisateur (keny4nn) — économie de tokens, mémoire persistante, génération vidéo/motion avec Claude Code, et dev piloté par spec. À consulter quand on travaille sur n'importe lequel de ses 6 projets (LOG, TTL, V3D, P3D, ITS, PFA) pour savoir quel outil appliquer et comment. Chaque entrée a un lien vérifié et un cas d'usage par projet.
---

# Veille — Boîte à outils IA (vérifiée)

Référence vivante. Source : `Desktop/HUB/Veille/Ressources.md` (le cerveau de veille de HUB, au-dessus des 6 projets). Tous les liens sont vérifiés (pas d'invention).

## 1. Économie de tokens / contexte
- **`AGENTS.md` lean** — https://github.com/ai-driven-dev/framework (`plugins/aidd-context/skills/02-project-memory/assets/AGENTS.md`).
  ~20 règles : réponse d'abord, pas de préambule, **changement chirurgical**, source-first, batch/parallèle, anti-flagornerie, finir par la prochaine action. → adopter dans l'`AGENTS.md` de chaque projet.
- **`/btw`** (Claude Code) — poser une question PENDANT que Claude travaille ; la réponse n'entre PAS dans le contexte/historique → 0 token. (à vérifier selon version.)
- **codebase-memory-mcp** — https://github.com/DeusData/codebase-memory-mcp (19k⭐, MIT, local, signé). Serveur **MCP** qui indexe un repo en graphe (tree-sitter, 158 langages) → **−~99 % tokens** sur les requêtes de structure. Install propre : npm/pip/Homebrew (PAS le `curl|bash`). → idéal sur **TTL / V3D / P3D** (gros code).

## 2. Mémoire persistante / « second cerveau »
- **MEMANTO** — https://github.com/moorcheh-ai/memanto (`pip install memanto`, local, open-source). Remember/recall/answer à travers les sessions.
- **Méthode Karpathy** (gist avr. 2026) — dossier de markdown + un `CLAUDE.md` qui fait de Claude un *mainteneur de wiki* (ops `/capture /sync /lint /digest`). → modèle pour faire évoluer `LOG/_brain/Veille` en vrai cerveau auto-maintenu.

## 3. Vidéo / motion design avec Claude Code  (→ LOG, PFA)
- **browser-use/video-use** — https://github.com/browser-use/video-use. *Éditer des vidéos avec Claude Code* : coupe filler, color grade, sous-titres, overlays **Remotion/Manim/PIL**, timestamps via **ElevenLabs Scribe**, auto-évaluation. (Skill ; besoin de ffmpeg + clé ElevenLabs.)
- **Remotion + Claude Code + un `CLAUDE.md` dédié** (créateur dryxio.us) — génère illus/motion en 1 prompt ; fournir le script en **SRT** pour les timings. → LOG utilise déjà Remotion + ElevenLabs : applicable direct.

## 4. Dev piloté par spec / gestion de skills  (→ tous)
- **Spec Kit** — https://github.com/github/spec-kit (officiel GitHub). Flux `/constitution → /specify → /plan → /implement`. Marche avec Claude Code. → cadrer un gros chantier (TTL, V3D).
- **Find Skills / `npx skills`** (skills.sh, Vercel) — découverte/install de skills par objectif, multi-agents.

## 5. Business (→ LOG ebook)
- 10 prompts « produits digitaux » (échelle de prix low→premium, plateforme Gumroad/Payhip, mini-cours). Utile pour le **pricing/plateforme de l'ebook LOG**.

## Routage par projet
- **LOG** : video-use + Remotion (vidéos), prompts business (ebook).
- **TTL / V3D / P3D** : codebase-memory-mcp, Spec Kit. V3D Unity → cf. guide graphismes réalistes (YouTube).
- **ITS / PFA** : AGENTS.md lean. PFA (anti-IA) : prudence, n'utiliser que l'outillage, pas de génération de contenu.
- **Tous** : AGENTS.md lean + `/btw`.
