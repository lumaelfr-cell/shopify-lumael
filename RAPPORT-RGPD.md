# Rapport de conformité RGPD — Boutique Lumael (thème Horizon)

Scan réalisé le 2026-07-05 avec le plugin `gdpr-compliance-scanner` (marketplace claude-code-plugins-plus) sur l'ensemble du code du thème publié (layout, sections, blocks, snippets, templates, assets JS, config) et la configuration boutique (politiques, menus).

## Constats positifs

- Aucun traceur tiers (Google Analytics, Meta Pixel, TikTok, Hotjar…) injecté dans le code du thème.
- La politique de confidentialité existe (22 Ko, en français).
- L'usage de `sessionStorage` (état des tiroirs, chat) est strictement nécessaire au fonctionnement — exempté de consentement (ePrivacy, art. 5(3)).
- Les scripts Shopify (`standard-events.js`) relèvent de Shopify en tant que sous-traitant (art. 28, couvert par le DPA Shopify).

## Infractions relevées

| # | Gravité | Infraction | Base légale | Statut |
|---|---------|-----------|-------------|--------|
| 1 | 🔴 Critique | La politique de confidentialité n'est **accessible nulle part** sur la boutique : ni dans le footer, ni dans les menus. L'information doit être « aisément accessible » à la personne concernée. | Art. 12 §1 et Art. 13 RGPD | ✅ Corrigé — bloc `footer-policy-list` ajouté au footer (`sections/footer-group.json`) |
| 2 | 🟠 Élevée | Le formulaire d'inscription newsletter (footer + page mot de passe) collecte l'e-mail **sans aucune mention d'information** (finalité, responsable de traitement, droits, désinscription). Le consentement ne peut être « éclairé ». | Art. 13 et Art. 7 §2 RGPD ; recommandation CNIL | ✅ Corrigé — mention d'information avec lien vers la politique ajoutée sous le formulaire (`blocks/email-signup.liquid`) |
| 3 | 🟠 Élevée | Le formulaire de contact collecte nom, e-mail et message **sans mention d'information** au moment de la collecte. | Art. 13 RGPD | ✅ Corrigé — mention ajoutée avant le bouton d'envoi (`blocks/contact-form.liquid`) |
| 4 | 🟡 Moyenne | Impossible de vérifier dans le code qu'une **bannière de consentement cookies** est active. Le thème charge les événements analytics Shopify ; sans bannière, tout dépôt de cookie non essentiel serait illégal pour les visiteurs UE. | Art. 6 et 7 RGPD ; art. 82 Loi Informatique et Libertés (ePrivacy) | ⚠️ Action manuelle — activer dans l'admin Shopify : **Paramètres → Confidentialité des clients → Bannière de cookies** (régions : Europe) |
| 5 | 🟡 Moyenne | La boutique n'a **qu'une seule politique** publiée. Absents : CGV, politique de remboursement, mentions légales — obligatoires pour un site marchand français. | Art. 6-III LCEN ; Code de la consommation (connexe au RGPD) | ⚠️ Action manuelle — admin Shopify : **Paramètres → Politiques** (elles apparaîtront automatiquement dans le nouveau bloc du footer) |

## Correctifs appliqués dans ce dépôt

1. **`sections/footer-group.json`** — ajout du bloc natif `footer-policy-list` : affiche « Conditions et politiques » dans le footer avec un lien vers chaque politique publiée (dont la politique de confidentialité).
2. **`blocks/email-signup.liquid`** — mention d'information sous le champ e-mail : finalité (newsletter), responsable ({{ shop.name }}), droit de désinscription, lien vers la politique de confidentialité. Ne s'affiche que si une politique de confidentialité est publiée.
3. **`blocks/contact-form.liquid`** — mention d'information avant le bouton d'envoi : finalité (traitement de la demande), rappel des droits (accès, rectification, effacement, opposition), lien vers la politique.

## Comment déployer

L'API bloque l'écriture directe sur le thème **publié**. Deux options :

- **Option A (recommandée)** : dans l'admin Shopify, dupliquez le thème Horizon (Boutique en ligne → Thèmes → ⋯ → Dupliquer), puis dites-moi de pousser les correctifs sur la copie — je peux écrire sur un thème non publié. Vous publierez ensuite la copie.
- **Option B** : copiez-collez manuellement le contenu des 3 fichiers de ce dépôt dans l'éditeur de code du thème (Boutique en ligne → Thèmes → ⋯ → Modifier le code).

## Actions restantes côté admin (non corrigeables par code)

- Activer la bannière de cookies (constat #4).
- Publier les politiques manquantes : CGV, remboursement, mentions légales (constat #5).
- Vérifier que la newsletter utilise le **double opt-in** : Paramètres → Notifications → « Exiger une confirmation d'inscription » (recommandation CNIL).
