---
name: awesome-design-md
description: UI design system guideline skill powered by VoltAgent/awesome-design-md (Google Stitch DESIGN.md specification). Guides visual themes, semantic palettes, typography scales, component stylings, depth, layout, and guardrails across 70+ brand design languages (Linear, Stripe, Apple, Vercel, Supabase, Notion, Claude, Figma, Tailwind, etc.). Use when creating or refining UI components, pages, or entire web applications according to DESIGN.md.
---

# awesome-design-md Skill

This skill enforces high-craft, visually consistent UI generation based on the **DESIGN.md** design system format (introduced by Google Stitch) and the curated design profiles in [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md).

## Core Concepts

In this project:
- `AGENTS.md` defines how coding agents build and architect the project.
- `DESIGN.md` defines how the project looks, feels, and renders — colors, typography, components, surfaces, and spacing.

Whenever the user asks you to build, style, or refine an application or component, you **MUST** read and strictly follow the design specifications in `./DESIGN.md`.

---

## Available Design Systems

Over 70+ production-grade brand design languages are available in this project:

| Category | Available Profiles |
|---|---|
| **Developer Tools** | `linear.app`, `vercel`, `supabase`, `resend`, `mintlify`, `sentry`, `posthog`, `raycast`, `warp`, `clickhouse`, `mongodb`, `sanity` |
| **AI & LLM Platforms** | `claude`, `cohere`, `cursor`, `elevenlabs`, `mistral.ai`, `minimax`, `ollama`, `opencode.ai`, `replicate`, `runwayml`, `together.ai`, `voltagent`, `x.ai` |
| **Fintech & Crypto** | `stripe`, `wise`, `revolut`, `coinbase`, `binance`, `kraken`, `mastercard` |
| **Design & Productivity** | `figma`, `framer`, `notion`, `miro`, `webflow`, `airtable`, `clay`, `cal`, `superhuman`, `zapier`, `composio`, `lovable` |
| **Consumer & Media** | `apple`, `airbnb`, `nike`, `spotify`, `starbucks`, `theverge`, `wired`, `pinterest`, `playstation`, `uber`, `meta`, `hp`, `ibm`, `spacex`, `tesla` |
| **Automotive** | `bmw`, `bmw-m`, `bugatti`, `ferrari`, `lamborghini`, `renault` |
| **Nostalgia & Y2K** | `dell-1996`, `nintendo-2001` |

### Switching or Applying a Design System
To switch the active `DESIGN.md` file:
```bash
node scripts/design.mjs use <preset_name>
```
For example:
```bash
node scripts/design.mjs use stripe
node scripts/design.mjs use vercel
node scripts/design.mjs use linear.app
```

---

## Token Mapping Rules

When translating `DESIGN.md` into Tailwind CSS / React code:

### 1. Canvas & Surfaces
- Always respect the canvas luminance (e.g. Linear's `#08090a` / `#010102`, Stripe's light gradient/white, Vercel's `#000000` / `#ffffff`).
- Map surface levels:
  - `canvas`: Root background.
  - `surface-1`: Primary card/container background.
  - `surface-2`: Nested sections, dropdowns, or secondary panels.
  - `surface-3`: Active/hovered elements, badges, or elevated popovers.
- Never mix warm and cool darks. Adhere strictly to the hex values defined in `./DESIGN.md`.

### 2. Hairlines & Borders
- Use the exact border rgba or hex definitions (e.g. `rgba(255,255,255,0.06)` to `rgba(255,255,255,0.12)` for dark systems; subtle gray borders for light systems).
- Corner radius formula: `Inner Radius = Outer Radius - Padding`.

### 3. Typography & Hierarchy
- Maintain strict typographic scales:
  - **Display / Hero**: Tight letter spacing (negative tracking e.g. `-0.03em`), bold or semibold as specified in `DESIGN.md`.
  - **Headings**: Clear contrast with body text.
  - **Body**: Highly readable, minimum 14-16px, line height 1.5–1.7.
  - **Mono**: Use monospace styling for codes, timestamps, metrics, or technical tags if mandated by the design profile.

### 4. Component Stylings
- **Buttons**:
  - Primary button: Single brand accent or crisp high-contrast background with exact hover/focus states.
  - Secondary/Ghost button: Subtle surface or transparent with hairline border.
  - Button horizontal padding should be 2× vertical padding.
- **Cards**: Flat depth, subtle hairlines, deliberate padding (min 16px to 24px).
- **Inputs**: Clean background matching `surface-1` or `surface-2`, subtle border, crisp focus ring using the accent token.

---

## Anti-Slop Guardrails

1. **No generic gradient text or cyan/purple glows** unless explicitly part of the selected brand identity (e.g. Stripe's specific mesh gradients).
2. **No nested cards inside cards** without clear functional surface step-downs.
3. **No generic placeholder copy** ("supercharge your workflow", "empower your team").
4. **No missing event handlers** or half-baked stubs.
5. Keep the design cohesive with the designated `./DESIGN.md` from the first pixel to the last interaction.
