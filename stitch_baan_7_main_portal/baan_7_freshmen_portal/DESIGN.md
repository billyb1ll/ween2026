---
name: Baan 7 Freshmen Portal
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e4e2e1'
  on-surface: '#1b1c1c'
  on-surface-variant: '#424849'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0f0'
  outline: '#72787a'
  outline-variant: '#c2c7c9'
  surface-tint: '#496268'
  primary: '#496268'
  on-primary: '#ffffff'
  primary-container: '#c5e0e6'
  on-primary-container: '#4b6469'
  inverse-primary: '#b0cbd1'
  secondary: '#7c563f'
  on-secondary: '#ffffff'
  secondary-container: '#fdcaad'
  on-secondary-container: '#79533c'
  tertiary: '#5d5f5d'
  on-tertiary: '#ffffff'
  tertiary-container: '#dbdbd8'
  on-tertiary-container: '#5e605e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cce7ed'
  primary-fixed-dim: '#b0cbd1'
  on-primary-fixed: '#041f24'
  on-primary-fixed-variant: '#324b50'
  secondary-fixed: '#ffdbc8'
  secondary-fixed-dim: '#eebca0'
  on-secondary-fixed: '#2f1504'
  on-secondary-fixed-variant: '#613f29'
  tertiary-fixed: '#e2e3e0'
  tertiary-fixed-dim: '#c6c7c4'
  on-tertiary-fixed: '#1a1c1b'
  on-tertiary-fixed-variant: '#454745'
  background: '#fcf9f8'
  on-background: '#1b1c1c'
  surface-variant: '#e4e2e1'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Playfair Display
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1200px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style
The design system for this portal focuses on the transition from high school to university life, balancing academic prestige with the warmth of a welcoming community. The brand personality is **Modern, Warm, and Interactive**, aiming to reduce "freshman anxiety" through a premium, calm, and organized interface.

The aesthetic leans into **Modern Minimalism** with a **Tactile** edge. It utilizes generous whitespace to prevent information overload, paired with smooth micro-interactions that make the digital journey feel like a physical guided tour. The interface should evoke a sense of "New Beginnings"—clean, bright, and full of potential.

## Colors
The palette is rooted in an organic, "Ivory" base to create a sophisticated alternative to pure white. 

- **Primary Accent (Blue Lagoon):** Used for large surface areas, subtle background glows, and soft hover states. It represents the "modern" and "calm" aspect of the brand.
- **Primary Text & Action (Chocolate Fondant):** This high-contrast shade provides the "warmth." It is reserved for typography that needs to command attention and for the most important interactive elements.
- **Base Surfaces:** Ivory is the canvas, while pure white is used sparingly for card surfaces to create subtle layered depth.

## Typography
The typographic scale relies on the contrast between the traditional elegance of **Playfair Display** and the contemporary efficiency of **Plus Jakarta Sans**.

- **Serif Headers:** Use Playfair Display for all headlines. To maintain the "premium" feel, keep tracking slightly tight on larger sizes.
- **Geometric Body:** Plus Jakarta Sans is used for all functional text. The line height is intentionally generous (1.6) to ensure high readability for long-form orientation guides.
- **Labels:** Use uppercase Jakarta Sans with increased letter spacing for small metadata or section overlines to provide a modern, "architectural" feel.

## Layout & Spacing
The layout follows a **Fluid Grid** model with strict maximum widths to maintain readability on ultra-wide monitors.

- **Desktop (1200px+):** A 12-column grid with 24px gutters. Use wide 64px outer margins to create the "generous whitespace" required by the brand.
- **Mobile (<768px):** A 4-column grid with 16px gutters and 20px margins.
- **Vertical Rhythm:** Use a base 8px scale. Component spacing should favor "breathability"—when in doubt, add more padding rather than less.
- **Interactive Line:** A central SVG "Chocolate Fondant" line acts as a visual guide, weaving between sections to connect the narrative of the orientation.

## Elevation & Depth
This design system avoids heavy shadows in favor of **Tonal Layers** and **Soft Blurs**.

- **Depth:** Surfaces are defined by color shifts (e.g., White cards on an Ivory background) rather than aggressive shadows.
- **The "Glow":** Use the "Blue Lagoon" color as a soft, diffused drop shadow (blur: 40px, opacity: 20%) behind primary cards or buttons to create a "halo" effect.
- **Interactive State:** When an element is hovered, increase its scale slightly (1.02x) and deepen the Blue Lagoon glow to simulate it lifting off the Ivory surface.

## Shapes
The shape language is defined by **"2xl" soft rounded corners**. This removes any visual "sharpness" from the portal, reinforcing the approachable and friendly nature of the university community.

- **Standard Elements:** Use 1rem (16px) for standard cards and input fields.
- **Large Containers:** Use 1.5rem (24px) for hero sections or main content blocks.
- **Interactive Line:** All path terminals and joints in the interactive SVG line should be rounded.

## Components

### Buttons
- **Primary:** "Chocolate Fondant" background with Ivory text. 2xl roundedness. No border. On hover, apply a soft "Blue Lagoon" glow.
- **Secondary:** Transparent background with "Chocolate Fondant" border (1px) and text.
- **Ghost:** "Blue Lagoon" background at 15% opacity with "Chocolate Fondant" text.

### Cards
- **Orientation Card:** White surface, 24px padding, 2xl rounded corners. Use a subtle 1px border in a darkened Ivory shade to define edges against the Ivory background.

### Input Fields
- Ivory-tinted background (slightly darker than the base surface) with 16px roundedness. The focus state should feature a "Blue Lagoon" glow.

### Chips & Tags
- Used for "Baan" categories. These should be pill-shaped with "Blue Lagoon" backgrounds and "Chocolate Fondant" text to ensure they are easily scanable.

### Interactive SVG Line
- A 2px stroke in "Chocolate Fondant" that animates its "draw-in" effect as the user scrolls, acting as a progress indicator and thematic connector.