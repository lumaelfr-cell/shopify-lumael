# shopify-lumael

Dépôt de configuration Claude Code pour la boutique Shopify **Lumael**. Il ne contient pas de code applicatif : tout vit dans `.claude/`.

## Structure

- `.claude/skills/` — skills design/branding (source : claudekit) :
  - `design` — skill unifié : logo, identité de marque (CIP), slides, bannières, icônes, photos social media
  - `brand` — voix de marque, identité visuelle, cohérence, gestion d'assets
  - `design-system` — tokens (primitif → sémantique → composant), specs de composants, génération de slides
  - `banner-design` — bannières multi-formats (réseaux sociaux, ads, hero web, print)
  - `slides` — présentations HTML avec Chart.js
  - `ui-styling` — shadcn/ui + Tailwind CSS
  - `ui-ux-pro-max` — référence UI/UX (styles, palettes, typographies, guidelines)
- `.claude/settings.json` — permissions partagées du projet

## Conventions

- Réponds en français à l'utilisateur ; le code, les commits et les identifiants restent en anglais.
- Contexte : e-commerce Shopify. Pour les opérations boutique (produits, collections, commandes, analytics), utilise les outils MCP Shopify quand ils sont disponibles.
- Les scripts des skills (`scripts/*.py`, `scripts/*.cjs`) s'exécutent avec `python3` / `node` depuis la racine du dépôt.
- Ne modifie pas les skills claudekit en profondeur sans demande explicite : préfère ajouter des overrides ou de nouveaux skills.
- Les préférences personnelles vont dans `.claude/settings.local.json` (non versionné), pas dans `settings.json`.
