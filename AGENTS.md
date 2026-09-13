# Project Instructions: awesome-design-md Integration

## Design Authority
All UI design, visual aesthetics, color palettes, typography, spacing, surface hierarchy, and component styling in this project are governed by `./DESIGN.md`.

- Reference repository: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
- Design specification: Google Stitch `DESIGN.md` format.
- Skill documentation: `skills/awesome-design-md/SKILL.md`

## Rules for AI Coding Agent
1. **Always Inspect `./DESIGN.md`**: Before writing or refactoring UI components, view `./DESIGN.md` to identify the active design tokens (palette hex codes, surface luminance, font styles, border opacity, and button variants).
2. **Follow Strict Token Fidelity**:
   - Use the specific background surface shades (`canvas`, `surface-1`, `surface-2`, `surface-3`).
   - Use the designated brand accent color for active states and CTAs.
   - Use the specified letter-spacing and typography scales.
   - Avoid generic AI clichés: no arbitrary cyan glows, no nested card clutter, no marketing fluff.
3. **Switching Design Systems**:
   - If the user requests a different brand look (e.g. Stripe, Vercel, Supabase, Apple, Notion, Claude), run:
     ```bash
     node scripts/design.mjs use <preset_name>
     ```
   - Then regenerate or adjust the UI to match the new `DESIGN.md`.
