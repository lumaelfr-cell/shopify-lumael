# Graph Report - shopify-lumael  (2026-08-25)

## Corpus Check
- 120 files · ~98,909 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1065 nodes · 1418 edges · 119 communities (68 shown, 51 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 57 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Design Token Templates
- CIP Search Core (BM25)
- Slide Search CLI
- shadcn Component Reference
- Semantic Color Tokens
- Design Token Templates
- Tailwind Config Tests
- HTML Token Validator
- Slides Copywriting Formulas
- Logo Search Core (BM25)
- Brand & Banner Guidelines
- Tailwind Config Generator
- Slide Deck Generator
- Design System Formatter
- Background Image Fetcher
- Design System Reasoning Engine
- Icon Generation Script
- Design Token Templates
- shadcn Installer Tests
- shadcn Accessibility Reference
- Brand Color Extractor (JS)
- Asset Filename Validator
- UI Reasoning Data Sync
- Design Token Templates
- Token Usage Validator (JS)
- Canvas Design System & Tailwind Responsive
- shadcn Add Script & Tests
- shadcn Installer Core
- Tailwind Config String Generator
- Brand Context Injector (JS)
- Token Embedding Script (JS)
- Design Token Templates
- UI Styling Skill Overview
- shadcn Add Error-Path Tests
- Tailwind Config Generation Tests
- Scripts Search Core (BM25)
- Design Skill Routing Guide
- Tailwind Config Class Init
- Logo Generation Script
- Design Token CSS Generator (JS)
- Design Token Templates
- Tailwind Customization Reference
- CIP & Logo Prompt Engineering
- Brand-to-Tokens Sync Script (JS)
- Token Validator Regression Tests
- shadcn Button & Theming Reference
- BM25 Ranking Algorithm
- CIP Design Style Guide
- Logo Style Guide (Types)
- Design Token Templates
- Design Token Templates
- Design Token Templates
- Tailwind Utilities Reference
- UI/UX Pro Max Skill Overview
- CIP Scripts & Deliverables
- Screenshot Capture Scripts
- Design Token Templates
- Page Override Generator
- Design Tokens Starter Template
- Design Token Templates
- Design Token Templates
- shadcn Theming & CSS Variables
- Banner Art Direction Styles
- Design Token Templates
- Design Token Templates
- Design Token Templates
- Design Token Templates
- Design Token Templates
- Brand-to-Tokens Sync Tests
- Slide Token Validator
- shadcn Installer Init
- Test Fixture: Temp Project
- Font Licenses (Big Shoulders, DM Mono)
- Font Licenses (Gloock, Italiana)
- Font Licenses (Libre Baskerville, Lora)
- shadcn Add: No Config Test
- shadcn Add: Already Installed Test
- shadcn Installer Default Root Test
- shadcn Installer Dry Run Test
- shadcn Config Check Test
- shadcn Installed Components Empty Test
- shadcn Installed Components Test
- Tailwind Custom Fonts Test
- Tailwind Plugin Recommendation Test
- Tailwind TypeScript Config Test
- Tailwind Custom Colors Test
- Tailwind Plugin Config Test
- Tailwind Content Path Validation Test
- Tailwind Theme Extension Test
- Tailwind Config Write Test
- Tailwind JavaScript Init Test
- Tailwind Config Content Test
- Tailwind Invalid Path Test
- Tailwind Full JS Config Test
- Tailwind TypeScript Output Path Test
- Tailwind Base Config Structure Test
- Tailwind Vue Content Paths Test
- Tailwind Custom Colors Add Test
- Font License (Arsenal SC)
- Font License (Boldonse)
- Font License (Bricolage Grotesque)
- Font License (Crimson Pro)
- Font License (Erica One)
- Font License (Geist Mono)
- Font License (IBM Plex Mono)
- Font License (Instrument Sans)
- Font License (JetBrains Mono)
- Font License (Jura)
- Font License (National Park)
- Font License (Nothing You Could Do)
- Font License (Outfit)
- Font License (Pixelify Sans)
- Font License (Poiret One)
- Font License (Red Hat Mono)
- Font License (Silkscreen)
- Font License (Smooch Sans)
- Font License (Tektur)
- Font License (Work Sans)
- Font License (Young Serif)

## God Nodes (most connected - your core abstractions)
1. `TailwindConfigGenerator` - 58 edges
2. `TestTailwindConfigGenerator` - 35 edges
3. `ShadcnInstaller` - 34 edges
4. `shadcn-components.md reference` - 27 edges
5. `TestShadcnInstaller` - 26 edges
6. `color` - 15 edges
7. `UI Styling Skill` - 15 edges
8. `shadcn-accessibility.md reference` - 15 edges
9. `Brand Skill` - 14 edges
10. `search_with_context()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Luxury Premium Style` --semantically_similar_to--> `Logo Style Guide`  [INFERRED] [semantically similar]
  .claude/skills/design/references/cip-style-guide.md → .claude/skills/design/references/logo-style-guide.md
- `Color Palette Management` --semantically_similar_to--> `Primitive Tokens`  [INFERRED] [semantically similar]
  .claude/skills/brand/references/color-palette-management.md → .claude/skills/design-system/references/primitive-tokens.md
- `Typography Specifications` --semantically_similar_to--> `Primitive Tokens`  [INFERRED] [semantically similar]
  .claude/skills/brand/references/typography-specifications.md → .claude/skills/design-system/references/primitive-tokens.md
- `States and Variants` --semantically_similar_to--> `Semantic Tokens`  [INFERRED] [semantically similar]
  .claude/skills/design-system/references/states-and-variants.md → .claude/skills/design-system/references/semantic-tokens.md
- `Tailwind Integration` --semantically_similar_to--> `Semantic Tokens`  [INFERRED] [semantically similar]
  .claude/skills/design-system/references/tailwind-integration.md → .claude/skills/design-system/references/semantic-tokens.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three-Layer Token Architecture (Primitive→Semantic→Component)** — claude_skills_design_system_references_token_architecture, claude_skills_design_system_references_primitive_tokens, claude_skills_design_system_references_semantic_tokens, claude_skills_design_system_references_component_tokens [EXTRACTED 0.90]
- **Brand-to-Design-Tokens Sync Workflow** — claude_skills_brand_skill, claude_skills_brand_references_update, claude_skills_design_system_skill, claude_skills_brand_templates_brand_guidelines_starter [EXTRACTED 0.85]
- **Unified Design Skill Sub-Skill Routing** — claude_skills_design_skill, claude_skills_brand_skill, claude_skills_design_system_skill, claude_skills_banner_design_skill [EXTRACTED 0.85]
- **CIP Design Generation Workflow** — design_scripts_cip_search_py, design_scripts_cip_generate_py, design_scripts_cip_render_html_py [EXTRACTED 1.00]
- **Brand to Design-System to UI-Styling Dependency Chain** — skill_brand, skill_design_system, skill_ui_styling [EXTRACTED 1.00]
- **Duplicated Slides Reference Content Across design and slides Skills** — design_references_slides_slides_reference, claude_skills_slides_skill_slides_skill, slides_references_html_template_html_slide_template [INFERRED 0.85]
- **UI Styling Core Stack** — claude_skills_ui_styling_skill_shadcn_ui, claude_skills_ui_styling_skill_tailwind_css, claude_skills_ui_styling_skill_canvas_design_system [EXTRACTED 0.90]
- **Fonts under SIL OFL 1.1 (Arsenal SC to Red Hat Mono)** — claude_skills_ui_styling_canvas_fonts_arsenalsc_ofl_font, claude_skills_ui_styling_canvas_fonts_bigshoulders_ofl_font, claude_skills_ui_styling_canvas_fonts_boldonse_ofl_font, claude_skills_ui_styling_canvas_fonts_bricolagegrotesque_ofl_font, claude_skills_ui_styling_canvas_fonts_crimsonpro_ofl_font, claude_skills_ui_styling_canvas_fonts_dmmono_ofl_font, claude_skills_ui_styling_canvas_fonts_ericaone_ofl_font, claude_skills_ui_styling_canvas_fonts_geistmono_ofl_font, claude_skills_ui_styling_canvas_fonts_gloock_ofl_font, claude_skills_ui_styling_canvas_fonts_ibmplexmono_ofl_font, claude_skills_ui_styling_canvas_fonts_instrumentsans_ofl_font, claude_skills_ui_styling_canvas_fonts_italiana_ofl_font, claude_skills_ui_styling_canvas_fonts_jetbrainsmono_ofl_font, claude_skills_ui_styling_canvas_fonts_jura_ofl_font, claude_skills_ui_styling_canvas_fonts_librebaskerville_ofl_font, claude_skills_ui_styling_canvas_fonts_lora_ofl_font, claude_skills_ui_styling_canvas_fonts_nationalpark_ofl_font, claude_skills_ui_styling_canvas_fonts_nothingyoucoulddo_ofl_font, claude_skills_ui_styling_canvas_fonts_outfit_ofl_font, claude_skills_ui_styling_canvas_fonts_pixelifysans_ofl_font, claude_skills_ui_styling_canvas_fonts_poiretone_ofl_font, claude_skills_ui_styling_canvas_fonts_redhatmono_ofl_font [EXTRACTED 0.98]
- **Fonts under SIL OFL 1.1** — claude_skills_ui_styling_canvas_fonts_silkscreen_ofl_font, claude_skills_ui_styling_canvas_fonts_smoochsans_ofl_font, claude_skills_ui_styling_canvas_fonts_tektur_ofl_font, claude_skills_ui_styling_canvas_fonts_worksans_ofl_font, claude_skills_ui_styling_canvas_fonts_youngserif_ofl_font [EXTRACTED 0.95]
- **shadcn/ui Accessible Component Documentation Across References** — claude_skills_ui_styling_references_shadcn_accessibility, claude_skills_ui_styling_references_shadcn_components, claude_skills_ui_styling_references_shadcn_theming [INFERRED 0.85]
- **Tailwind Styling Reference Set (Customization, Responsive, Utilities)** — claude_skills_ui_styling_references_tailwind_customization, claude_skills_ui_styling_references_tailwind_responsive, claude_skills_ui_styling_references_tailwind_utilities [INFERRED 0.85]
- **UI Styling Skill Set (ui-styling + ui-ux-pro-max) Sharing Design Intelligence Workflow** — claude_skills_ui_styling_scripts_requirements, claude_skills_ui_ux_pro_max_skill, claude_skills_ui_styling_references_shadcn_theming [INFERRED 0.65]

## Communities (119 total, 51 thin omitted)

### Community 0 - "Design Token Templates"
Cohesion: 0.05
Nodes (53): $type, $value, $type, $value, $type, $value, $type, $value (+45 more)

### Community 1 - "CIP Search Core (BM25)"
Cohesion: 0.07
Nodes (42): BM25, detect_domain(), get_cip_brief(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection (+34 more)

### Community 2 - "Slide Search CLI"
Cohesion: 0.08
Nodes (36): format_context(), format_result(), main(), Format a single search result for display, Format contextual recommendations for display., BM25, calculate_pattern_break(), detect_domain() (+28 more)

### Community 3 - "shadcn Component Reference"
Cohesion: 0.05
Nodes (39): shadcn-components.md reference, Accordion Component, Alert Component, AlertDialog Component, Avatar Component, Badge Component, Calendar / Date Picker Component, Card Component (+31 more)

### Community 4 - "Semantic Color Tokens"
Cohesion: 0.05
Nodes (37): $type, $value, background, destructive, destructive-foreground, foreground, muted, muted-foreground (+29 more)

### Community 5 - "Design Token Templates"
Cohesion: 0.06
Nodes (34): $type, $value, $type, $value, $type, $value, $type, $value (+26 more)

### Community 6 - "Tailwind Config Tests"
Cohesion: 0.06
Nodes (16): Test adding colors multiple times., Test adding full color palette., Test adding custom breakpoints., Test TailwindConfigGenerator class., Test that adding same plugin twice doesn't duplicate., Test plugin recommendations for Next.js., Test initialization with default settings., Test generating JavaScript configuration. (+8 more)

### Community 7 - "HTML Token Validator"
Cohesion: 0.13
Nodes (24): get_context(), is_allowed_exception(), is_allowed_rgba(), is_inside_block(), load_css_variables(), main(), print_result(), print_summary() (+16 more)

### Community 8 - "Slides Copywriting Formulas"
Cohesion: 0.09
Nodes (27): Slides Skill, AIDA formula (design), Before-After-Bridge formula (design), Copywriting Formulas (design), Cost of Inaction formula (design), FAB formula (design), PAS formula (design), Slides Create Command (design) (+19 more)

### Community 9 - "Logo Search Core (BM25)"
Cohesion: 0.11
Nodes (19): BM25, detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search across all domains and combine results (+11 more)

### Community 10 - "Brand & Banner Guidelines"
Cohesion: 0.14
Nodes (24): Banner Sizes & Art Direction Styles Reference, Banner Design Skill, Asset Approval Checklist, Asset Organization Guide, Brand Guidelines Template, Color Palette Management, Brand Consistency Checklist, Logo Usage Rules (+16 more)

### Community 11 - "Tailwind Config Generator"
Cohesion: 0.10
Nodes (12): main(), Add custom font families. Args: fonts: Dict of font_type: [font_names] e.g.,…, Add custom spacing values. Args: spacing: Dict of name: value e.g., {'18':…, Add custom breakpoints. Args: breakpoints: Dict of name: width e.g., {'3xl':…, Add plugin requirements. Args: plugins: List of plugin names e.g.,…, Get plugin recommendations based on configuration. Returns: List of recommended…, Generate Tailwind CSS configuration files., Validate configuration. Returns: Tuple of (valid, message) (+4 more)

### Community 12 - "Slide Deck Generator"
Cohesion: 0.15
Nodes (19): _e(), generate_chart_slide(), generate_cta_slide(), generate_deck(), generate_metrics_slide(), generate_problem_slide(), generate_solution_slide(), generate_testimonial_slide() (+11 more)

### Community 13 - "Design System Formatter"
Cohesion: 0.15
Nodes (18): ansi_ljust(), format_ascii_box(), format_markdown(), format_master_md(), generate_design_system(), hex_to_ansi(), persist_design_system(), Convert hex color to ANSI True Color swatch (██) with fallback. (+10 more)

### Community 14 - "Background Image Fetcher"
Cohesion: 0.17
Nodes (17): generate_css_for_background(), get_background_image(), get_curated_images(), get_overlay_css(), get_pexels_search_url(), load_backgrounds_config(), load_brand_colors(), main() (+9 more)

### Community 15 - "Design System Reasoning Engine"
Cohesion: 0.16
Nodes (9): DesignSystemGenerator, Select best matching result based on priority keywords., Extract results list from search result dict., Generate complete design system recommendation., Generates design system recommendations from aggregated searches., Load reasoning rules from CSV., Execute searches across multiple domains., Find matching reasoning rule for a category. (+1 more)

### Community 16 - "Icon Generation Script"
Cohesion: 0.20
Nodes (15): apply_color(), apply_viewbox_size(), extract_svgs(), generate_batch(), generate_icon(), generate_sizes(), load_env(), main() (+7 more)

### Community 17 - "Design Token Templates"
Cohesion: 0.12
Nodes (16): $type, $value, $type, $value, $type, $value, $type, $value (+8 more)

### Community 18 - "shadcn Installer Tests"
Cohesion: 0.12
Nodes (9): Test adding components in dry run mode., Test ShadcnInstaller class., Test adding all components without config., Test adding all components in dry run mode., Test listing installed components without config., Test listing installed components when none exist., Test initialization with custom project root., Test checking for non-existent shadcn config. (+1 more)

### Community 19 - "shadcn Accessibility Reference"
Cohesion: 0.13
Nodes (15): shadcn-accessibility.md reference, Accordion Component (accessibility), Alert Component (accessibility), @axe-core/react, Checkbox Component (accessibility), Command Palette Component, Dialog Component, DropdownMenu Component (+7 more)

### Community 20 - "Brand Color Extractor (JS)"
Cohesion: 0.22
Nodes (11): calculateCompliance(), colorDistance(), displayPalette(), extractHexColors(), findNearestBrandColor(), fs, generateImageMagickCommand(), hexToRgb() (+3 more)

### Community 21 - "Asset Filename Validator"
Cohesion: 0.25
Nodes (13): checkManifest(), formatBytes(), formatOutput(), fs, main(), parseFilename(), path, RULES (+5 more)

### Community 22 - "UI Reasoning Data Sync"
Cohesion: 0.29
Nodes (13): blend(), derive_row(), derive_ui_reasoning(), h2r(), is_dark(), lum(), on_color(), r2h() (+5 more)

### Community 23 - "Design Token Templates"
Cohesion: 0.18
Nodes (13): $type, $value, border, padding, radius, shadow, border, card (+5 more)

### Community 24 - "Token Usage Validator (JS)"
Cohesion: 0.24
Nodes (11): extensions, formatReport(), fs, getFiles(), main(), parseArgs(), path, patterns (+3 more)

### Community 25 - "Canvas Design System & Tailwind Responsive"
Cohesion: 0.17
Nodes (12): Canvas Design System, Canvas Design Movement Examples (Concrete Poetry, Chromatic Language, etc.), oklch Color Space, Two-Phase Design Process (Philosophy then Expression), @theme Directive, tailwind-responsive.md reference, Default Breakpoint System (sm/md/lg/xl/2xl), Container Queries (@container) (+4 more)

### Community 26 - "shadcn Add Script & Tests"
Cohesion: 0.20
Nodes (7): main(), Handle shadcn/ui component installation., ShadcnInstaller, Tests for shadcn_add.py, Test listing installed components when they exist., Test getting installed components without config., Test adding components with empty list.

### Community 27 - "shadcn Installer Core"
Cohesion: 0.21
Nodes (6): Add all available shadcn/ui components. Args: overwrite: If True, overwrite…, List installed components. Returns: Tuple of (success, message with component…, Check if shadcn is initialized in project. Returns: True if components.json…, Get list of already installed components. Returns: List of installed component…, Read shadcn version from project package.json; fall back to a pinned default., Add shadcn/ui components. Args: components: List of component names to add…

### Community 28 - "Tailwind Config String Generator"
Cohesion: 0.20
Nodes (6): Generate configuration file content. Returns: Configuration file as string, Generate TypeScript configuration., Generate JavaScript configuration., Format plugins array for config. Validates each plugin name against a strict…, Add indentation to JSON string., Write configuration to file. Returns: Tuple of (success, message)

### Community 29 - "Brand Context Injector (JS)"
Cohesion: 0.31
Nodes (10): extractColorsFromTable(), extractCoreAttributes(), extractHexColors(), extractImageStyle(), extractTypography(), extractVoice(), fs, generatePromptAddition() (+2 more)

### Community 30 - "Token Embedding Script (JS)"
Cohesion: 0.18
Nodes (8): args, fs, minimal, MINIMAL_TOKENS, path, projectRoot, tokensPath, wrapStyle

### Community 31 - "Design Token Templates"
Cohesion: 0.18
Nodes (11): fast, normal, slow, $type, $value, $type, $value, primitive (+3 more)

### Community 32 - "UI Styling Skill Overview"
Cohesion: 0.27
Nodes (11): Apache License 2.0 (ui-styling skill), canvas-design-system.md reference, shadcn_add.py, Accessibility Patterns, Canvas-based Visual Design System, Dark Mode Implementation, Radix UI, shadcn/ui (+3 more)

### Community 33 - "shadcn Add Error-Path Tests"
Cohesion: 0.18
Nodes (6): Test adding components with overwrite flag., Test successful component addition., Test component addition with subprocess error., Test component addition when npx is not found., Test successful addition of all components., patch

### Community 34 - "Tailwind Config Generation Tests"
Cohesion: 0.22
Nodes (8): Tests for tailwind_config_gen.py, Reduce a generated TS/JS config to a bare assignable object so it can be handed…, Regression guard for the missing-comma bug between the ``theme`` block and…, The property preceding ``plugins`` must end with a comma (pure-Python check, so…, The emitted config parses as valid JS via ``node --check``., _strip_to_object(), TestGeneratedConfigIsValidJs, parametrize

### Community 35 - "Scripts Search Core (BM25)"
Cohesion: 0.25
Nodes (10): detect_domain(), _load_csv(), Load CSV and return list of dicts, Core search function using BM25, Auto-detect the most relevant domain from query, Main search function with auto-domain detection, Search stack-specific guidelines, search() (+2 more)

### Community 36 - "Design Skill Routing Guide"
Cohesion: 0.27
Nodes (11): Design Routing Guide, gemini-3.1-pro-preview model, Icon Design Reference, scripts/icon/generate.py, brand skill, cip-design skill, design-system skill, icon-design skill (+3 more)

### Community 37 - "Tailwind Config Class Init"
Cohesion: 0.22
Nodes (6): Any, Path, Initialize generator. Args: typescript: If True, generate .ts config, else .js…, Determine default output path., Create base configuration structure., Get default content paths for framework.

### Community 38 - "Logo Generation Script"
Cohesion: 0.29
Nodes (9): enhance_prompt(), generate_batch(), generate_logo(), load_env(), main(), Enhance the logo prompt with style and industry modifiers, Generate a logo using Gemini models with image generation Args: aspect_ratio:…, Generate multiple logo variants with different styles (+1 more)

### Community 39 - "Design Token CSS Generator (JS)"
Cohesion: 0.36
Nodes (9): flattenTokens(), fs, generateCSS(), generateTailwind(), main(), parseArgs(), path, resolveReference() (+1 more)

### Community 40 - "Design Token Templates"
Cohesion: 0.20
Nodes (10): fg, font-size, hover-bg, button, $type, $value, $type, $value (+2 more)

### Community 41 - "Tailwind Customization Reference"
Cohesion: 0.20
Nodes (10): tailwind-customization.md reference, @apply Directive, @tailwindcss/container-queries Plugin, Custom Tailwind Plugin (tailwindcss/plugin), @utility Custom Utility Classes, @custom-variant Directive, @tailwindcss/forms Plugin, @layer Organization (base/components/utilities) (+2 more)

### Community 42 - "CIP & Logo Prompt Engineering"
Cohesion: 0.20
Nodes (10): CIP Base Prompt Structure, CIP Mockup Prompt Engineering, Logo Color Psychology, Logo Design Reference, Logo Core Prompt Structure, Logo AI Prompt Engineering, scripts/logo/core.py, scripts/logo/generate.py (+2 more)

### Community 43 - "Brand-to-Tokens Sync Script (JS)"
Cohesion: 0.33
Nodes (8): adjustBrightness(), { execFileSync }, extractColorsFromMarkdown(), fs, generateColorScale(), main(), path, updateDesignTokens()

### Community 44 - "Token Validator Regression Tests"
Cohesion: 0.28
Nodes (8): Path, Regression tests for validate-tokens.cjs. The validator used to skip any line…, A hardcoded hex on the same line as a var() token is still a violation., A line that references only tokens produces no false positives., _run(), test_flags_hardcoded_hex_sharing_line_with_token(), test_token_only_line_reports_no_violation(), CompletedProcess

### Community 45 - "shadcn Button & Theming Reference"
Cohesion: 0.25
Nodes (9): Button Component, shadcn-theming.md reference, components.json Configuration, cva (class-variance-authority) Component Variants, shadcn/ui Theme Generator (ui.shadcn.com/themes), Multiple Themes via data-theme Attribute, next-themes, Style Variants: Default vs New York (+1 more)

### Community 46 - "BM25 Ranking Algorithm"
Cohesion: 0.28
Nodes (5): BM25, BM25 ranking algorithm for text search, Lowercase, split, remove punctuation, filter short words, Build BM25 index from documents, Score all documents against query

### Community 47 - "CIP Design Style Guide"
Cohesion: 0.22
Nodes (9): Bold Dynamic Style, CIP Design Style Guide, Classic Traditional Style, Corporate Minimal Style, Fresh Modern Style, Luxury Premium Style, Modern Tech Style, Soft Elegant Style (+1 more)

### Community 48 - "Logo Style Guide (Types)"
Cohesion: 0.22
Nodes (9): Abstract Mark logo type, Combination Mark logo type, Emblem logo type, Lettermark logo type, Logo Style Guide, Mascot logo type, Pictorial Mark logo type, Logo Scalability Checklist (+1 more)

### Community 49 - "Design Token Templates"
Cohesion: 0.29
Nodes (8): padding-y, input, $type, $value, focus-ring, padding-y, $type, $value

### Community 50 - "Design Token Templates"
Cohesion: 0.25
Nodes (8): $type, $value, $type, $value, semantic, spacing, component, section

### Community 51 - "Design Token Templates"
Cohesion: 0.29
Nodes (8): $type, $value, $type, $value, radius, default, full, default

### Community 52 - "Tailwind Utilities Reference"
Cohesion: 0.25
Nodes (8): tailwind-utilities.md reference, Arbitrary Values (square bracket syntax), Borders & Shadows Utilities, Color Utilities (text/bg/gradient), Flexbox Utilities, Grid Utilities, Tailwind Spacing Scale, Typography Utilities

### Community 53 - "UI/UX Pro Max Skill Overview"
Cohesion: 0.25
Nodes (8): UI/UX Pro Max Skill, --design-system Flag, Search Domains (product, style, color, typography, chart, ux, react, web, prompt), Persist Master + Overrides Pattern (design-system/MASTER.md), scripts/search.py, shadcn/ui MCP Integration, Supported Stacks (react, nextjs, vue, svelte, shadcn, swiftui, flutter, react-native, etc.), ui-reasoning.csv

### Community 54 - "CIP Scripts & Deliverables"
Cohesion: 0.29
Nodes (8): CIP Deliverable Guide, CIP Design Reference, gemini-2.5-flash-image model, gemini-3-pro-image-preview model, scripts/cip/core.py, scripts/cip/generate.py, scripts/cip/render-html.py, scripts/cip/search.py

### Community 55 - "Screenshot Capture Scripts"
Cohesion: 0.29
Nodes (8): Chrome Headless CLI Screenshot Capture, Playwright Screenshot Capture Script, Puppeteer Screenshot Capture Script, Social Photos Design Guide, ai-artist skill, assets-organizing skill, chrome-devtools skill, project-management skill

### Community 56 - "Design Token Templates"
Cohesion: 0.47
Nodes (6): sm, shadow, sm, sm, $type, $value

### Community 57 - "Page Override Generator"
Cohesion: 0.33
Nodes (6): _detect_page_type(), format_page_override_md(), _generate_intelligent_overrides(), Detect page type from context and search results., Format a page-specific override file with intelligent AI-generated content., Generate intelligent overrides based on page type using layered search. Uses…

### Community 58 - "Design Tokens Starter Template"
Cohesion: 0.40
Nodes (4): component, dark, semantic, $schema

### Community 59 - "Design Token Templates"
Cohesion: 0.60
Nodes (5): $type, $value, bg, bg, bg

### Community 60 - "Design Token Templates"
Cohesion: 0.60
Nodes (5): lg, $type, $value, lg, lg

### Community 61 - "shadcn Theming & CSS Variables"
Cohesion: 0.40
Nodes (5): WCAG Color Contrast Requirements, CSS Variable System (HSL tokens), Tailwind Config Color Mapping to CSS Variables, tailwind.config.ts, tailwindcss-animate

### Community 62 - "Banner Art Direction Styles"
Cohesion: 0.40
Nodes (5): 22 Art Direction Styles, Visual Hierarchy 3-Zone Rule, Banner Sizes & Art Direction Styles Reference, Banner Safe Zones, banner-design skill

### Community 63 - "Design Token Templates"
Cohesion: 0.67
Nodes (4): padding-x, padding-x, $type, $value

### Community 64 - "Design Token Templates"
Cohesion: 0.67
Nodes (4): radius, radius, $type, $value

### Community 65 - "Design Token Templates"
Cohesion: 0.67
Nodes (4): xl, xl, $type, $value

### Community 66 - "Design Token Templates"
Cohesion: 0.67
Nodes (4): $type, $value, md, md

### Community 67 - "Design Token Templates"
Cohesion: 0.67
Nodes (4): $type, $value, none, none

## Knowledge Gaps
- **264 isolated node(s):** `fs`, `path`, `fs`, `path`, `fs` (+259 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `primitive` connect `Design Token Templates` to `Design Token Templates`, `Design Token Templates`, `Design Token Templates`, `Design Token Templates`, `Design Token Templates`, `Design Tokens Starter Template`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `color` connect `Design Token Templates` to `Design Token Templates`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `component` connect `Design Tokens Starter Template` to `Design Token Templates`, `Design Token Templates`, `Design Token Templates`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TailwindConfigGenerator` (e.g. with `TestGeneratedConfigIsValidJs` and `TestTailwindConfigGenerator`) actually correct?**
  _`TailwindConfigGenerator` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `fs`, `path`, `fs` to the rest of the system?**
  _264 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Design Token Templates` be split into smaller, more focused modules?**
  _Cohesion score 0.05370101596516691 - nodes in this community are weakly interconnected._
- **Should `CIP Search Core (BM25)` be split into smaller, more focused modules?**
  _Cohesion score 0.0653061224489796 - nodes in this community are weakly interconnected._