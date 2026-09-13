# Design System: Hunter Autoworks — The Car Lab

## 1. Visual Theme & Brand Atmosphere
Hunter Autoworks ("The Car Lab") is a high-precision automotive engineering and digital workshop operating system based in Kinondoni, Dar es Salaam. The aesthetic is mechanical, technical, and unmistakably automotive. It merges high-contrast dark-mode workshop telemetry with crisp, high-visibility daylight typography.

The experience embodies:
- **Mechanical Precision**: Clean hairline technical lines, caliper and chassis geometry, monospaced vehicle registration formatting (e.g. `T 123 ABC`), and indexed service codes (`01`, `02`, ..., `20`).
- **High-Luminance Contrast**: Deep pitch blacks (`#000000`) and midnight workshop navies (`#00101F`, `#002958`) offset with luminous electric blue accents (`#159EF3`) and pure crisp whites (`#FFFFFF`).
- **Zero AI-Slop**: Strictly no purple-to-blue generic SaaS gradients, no floating decorative blobs, no card-in-card clutter, and no fake statistics or dummy placeholders.
- **Mobile-First Utility**: Engineered for one-hand operation at 320px up to expansive 1920px multi-column workshop command centers.

## 2. Color Palette & Functional Roles
### Primary Surfaces
- **Hunter Black (Canvas)**: `#000000` — The bedrock canvas for the public site and workshop telemetry.
- **Hunter Navy (Surface 1)**: `#00101F` — Workshop panels, elevated cards, and header containers.
- **Deep Hunter Blue (Surface 2)**: `#002958` — Active selections, focused controls, and subtle structural gradients.
- **Technical Dark (Surface 3)**: `#0B1424` — Secondary table rows, inputs, and popovers.
- **Subtle Surface Highlight**: `#132038` — Hover states and elevated chips.

### Brand Accents & Interactive
- **Electric Blue (Primary Brand)**: `#159EF3` — CTAs, active step indicators, tracing service lines, key action icons.
- **Electric Blue Hover**: `#38B2FF` — Hover & touch focus.
- **Electric Blue Muted**: `rgba(21, 158, 243, 0.15)` — Subtle badge backing, selected item highlight.

### Text Hierarchy
- **White (Primary)**: `#FFFFFF` — Display headings, vehicle registrations, invoice numbers, key metrics.
- **Silver Titanium (Secondary)**: `#CBD5E1` — Body copy, service descriptions, table details.
- **Steel Gray (Tertiary / Muted)**: `#8E9BAE` — Form labels, timestamps, metadata.
- **Carbon Muted (Disabled)**: `#475569` — Disabled states, subtle divider lines.

### Semantic Alerts
- **Operational Green**: `#10B981` — Inspection "GOOD", Invoice "PAID", Work Order "READY".
- **Caution Amber**: `#F59E0B` — Inspection "ATTENTION", Work Order "AWAITING APPROVAL".
- **Critical Red**: `#EF4444` — Inspection "CRITICAL", Voided invoices, emergency brake alerts.

## 3. Typography Architecture
- **Display Typeface**: `'Chakra Petch', sans-serif` — Automotive technical display font with sharp, machined chamfers and authoritative stance for headings, prices, and status stamps.
- **UI & Body Typeface**: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif` — Highly legible, neutral, modern body font engineered for high-density mobile interfaces.
- **Monospace Telemetry**: `'JetBrains Mono', monospace` — Registration numbers (`T 123 ABC`), VIN codes, work order tags (`HA-WO-000184`), timestamps, and financial totals.

## 4. Layout & Spacing Rules
- **Container Math**: Minimum outer padding of 16px on mobile (`px-4`), expanding to 24px (`px-6`) on tablet and 32px (`px-8`) on desktop (`max-w-7xl mx-auto`).
- **Touch Target Integrity**: Minimum 44px tap targets for all mobile buttons, tabs, and interactive rows.
- **Service Tracing Line**: Consistent 2px electric blue hairline tracing that visually links the vehicle lifecycle:
  `BOOK` → `ARRIVE` → `INSPECT` → `SERVICE` → `QUALITY CHECK` → `DRIVE`.

## 5. Mobile-First & Responsive Gates
- **320px - 414px (Mobile Handheld)**: Sticky compact bottom bar (`Home`, `Services`, `Book`, `Status`, `More`), full-sheet modal sheets, stacked operational cards instead of wide horizontal tables.
- **768px (Tablet / Workshop Bay Mode)**: Technician inspection pad, side-by-side vehicle visual diagrams, fast-tap status buttons, split POS catalog & checkout cart.
- **1280px - 1920px (Desktop Control Command)**: Multi-column workshop board, live bay utilization, global telemetry filters, and dual-pane customer vehicle passports.
