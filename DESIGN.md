---
name: Baan 7 Main Portal
description: Unified design system for Baan 7 orientation experiences.
colors:
  primary: "#496268"
  primary-container: "#c5e0e6"
  secondary: "#7c563f"
  secondary-container: "#fdcaad"
  background: "#fcf9f8"
  surface: "#ffffff"
  surface-variant: "#e4e2e1"
  on-surface: "#1b1c1c"
  outline: "#72787a"
  error: "#ba1a1a"
typography:
  display:
    fontFamily: '"Playfair Display", Georgia, serif'
    fontSize: "clamp(2.25rem, 6vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '"Playfair Display", Georgia, serif'
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.05em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  xxl: "24px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.background}"
    rounded: "{rounded.xxl}"
    padding: "12px 24px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.xxl}"
    padding: "12px 24px"
  button-ghost:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.xxl}"
    padding: "12px 24px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xxl}"
    padding: "24px"
---

# Design System: Baan 7 Main Portal

## 1. Overview

**Creative North Star: "The Playful Orientation Guide"**

The Baan 7 Main Portal design system balances the academic prestige of university life with the warmth of a welcoming student community. Built around the theme of "New Beginnings," it rejects standard, clinical SaaS layouts in favor of an organic, tactile, and highly interactive digital space. 

By leveraging generous whitespace, high-contrast warm typography, and subtle micro-interactions, the interface aims to reduce "freshman anxiety" and encourage exploration. Every section and component is designed to feel custom-crafted, establishing a cohesive yet diverse ecosystem across the portal's sub-modules (Freshmen/Pro Portals, Memory Board, Hype Board, Vibe Check).

**Key Characteristics:**
- Organic color harmony featuring a warm Ivory canvas, rich Chocolate accents, and serene Lagoon Blue highlights.
- Clear typographic contrast between the traditional elegance of Playfair Display and the contemporary legibility of Plus Jakarta Sans.
- A tactile shape language utilizing soft 2xl rounded corners to reinforce friendliness and accessibility.
- Fluid visual continuity guided by an interactive SVG line weaving between layout sections.

## 2. Colors

The palette is rooted in an organic base to create a sophisticated, warm alternative to sterile white screens.

### Primary
- **Blue Lagoon** (#496268 / oklch(43.83% 0.046 211.59)): A serene, muted teal-blue used for secondary actions, subtle glows, and active state indicators. It introduces a modern, calming influence.

### Secondary
- **Chocolate Fondant** (#7c563f / oklch(44.33% 0.091 46.54)): A deep, warm chocolate-brown used for primary actions, headings, and high-contrast text. It delivers the brand's core warmth.

### Neutral
- **Warm Ivory** (#fcf9f8 / oklch(98.3% 0.005 45.0)): The base background canvas, providing a soft and readable surface.
- **Pure White** (#ffffff / oklch(100% 0.0 0.0)): Reserved for cards and container surfaces to build depth.
- **Charcoal Ink** (#1b1c1c / oklch(18.0% 0.005 45.0)): High-contrast body text color.

### Named Rules
**The Ivory Canvas Rule.** All background surfaces default to Warm Ivory (#fcf9f8). Pure white is strictly reserved for nested card containers to create layered visual depth.
**The Accent Rarity Rule.** Blue Lagoon is used as a soft primary accent for backgrounds/glows (≤15% of screen area). Chocolate Fondant is reserved for primary actions and key typography.

## 3. Typography

The typography highlights a deliberate pairing between classical serif authority and modern geometric clean lines.

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Plus Jakarta Sans (with system-ui, sans-serif fallback)

### Hierarchy
- **Display** (Bold (700), clamp(2.25rem, 6vw, 3rem), 1.1): Used for large hero headings; letter-spacing clamped at -0.02em for a crisp, custom display weight.
- **Headline** (Semi-bold (600), 2rem, 1.3): Used for section headers.
- **Title** (Medium (500), 1.25rem, 1.4): Used for subheaders and card titles.
- **Body** (Regular (400), 1rem, 1.6): Used for all orientation content and descriptions. Clamped at max 65–75ch for comfortable reading.
- **Label** (Semi-bold (600), 0.875rem, 1.2): Used for buttons, chips, and uppercase section overlines with 0.05em letter-spacing.

### Named Rules
**The Serif Headline Rule.** All display and headline elements must use Playfair Display. Do not use geometric sans for primary titles.
**The Line Length Rule.** Body copy must be clamped at a maximum width of 65-75ch to preserve readability.

## 4. Elevation

Depth in this design system is expressed primarily through tonal layering and color shifts rather than heavy drop shadows.

### Shadow Vocabulary
- **Lagoon Halo Glow** (`box-shadow: 0 12px 40px rgba(73, 98, 104, 0.15)`): Used for primary hover states and featured card containers to simulate a soft, ambient light source.
- **Ambient Shadow** (`box-shadow: 0 4px 20px rgba(27, 28, 28, 0.04)`): Used for floating components like dropdowns or navigation bars.

### Named Rules
**The Soft Glow Rule.** Do not use aggressive gray shadows. Convey depth using color boundaries (tonal shifts) or diffused Blue Lagoon halos behind featured cards.

## 5. Components

### Buttons
- **Shape:** Soft 2xl rounded corners (24px radius).
- **Primary:** Chocolate Fondant background with Warm Ivory text. Hover adds a subtle Lagoon Halo Glow and scales the button slightly (1.02x).
- **Secondary:** Transparent background with Chocolate Fondant border (1px) and text.
- **Ghost:** Light Blue Lagoon background (#c5e0e6) with Chocolate Fondant text.

### Chips / Tags
- **Style:** Pill-shaped (9999px radius) with a 15% opacity Blue Lagoon background (#496268 at 15%) and Chocolate Fondant text. Used for "Baan" categorization and tags.

### Cards / Containers
- **Corner Style:** Soft 2xl rounded corners (24px radius).
- **Background:** Pure White (#ffffff) on Warm Ivory canvas.
- **Border:** 1px solid outline (#c2c7c9 at 30% opacity) for definition.
- **Internal Padding:** Spacers between 24px and 32px.

### Inputs / Fields
- **Style:** Warm Ivory background (slightly darkened to #f0eded), 16px corner radius.
- **Focus:** 1px border shift to Blue Lagoon accompanied by a soft Lagoon Halo Glow.

### Navigation
- **Style:** Sticky header with a frosted glass background blur (backdrop-filter: blur(8px)) using Warm Ivory at 80% opacity. Label typography with active underline cues.

### Interactive SVG Line
- **Signature Component:** A 2px Chocolate Fondant stroke weaving between cards and layout blocks. Animates its draw-in as the user scrolls, creating a visual thread connecting freshman guide milestones.

## 6. Do's and Don'ts

### Do:
- **Do** default to Warm Ivory (#fcf9f8) backgrounds with Pure White (#ffffff) card overlays.
- **Do** clamp Playfair Display letter-spacing between -0.02em and -0.04em for headings.
- **Do** support a prefers-reduced-motion CSS fallback by cross-fading elements or displaying them instantly.
- **Do** use soft 2xl rounded corners (16px to 24px) for cards, buttons, and inputs.

### Don't:
- **Don't** use standard SaaS templates (e.g., left-content / right-image layouts).
- **Don't** use bento grids or glassmorphism as a default decoration.
- **Don't** use tiny uppercase tracked eyebrows on every section (reach for alternative cadences).
- **Don't** use purple, indigo, or default Tailwind blues.
- **Don't** pair borders with shadows greater than 8px blur unless utilizing the Lagoon Halo Glow.
- **Don't** allow long heading text to overflow containers on mobile (test clamps at all breakpoints).
