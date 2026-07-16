import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#f0f2f6" },
          100: { value: "#d9dee8" },
          200: { value: "#b3bdd1" },
          300: { value: "#8c9bba" },
          400: { value: "#667aa3" },
          500: { value: "#39425b" }, // Navy Blue (Base)
          600: { value: "#2d3448" },
          700: { value: "#222736" },
          800: { value: "#171a24" },
          900: { value: "#0b0d12" },
          950: { value: "#060709" },
        },
        pink: {
          50: { value: "#fef6f7" },
          100: { value: "#f7dcde" }, // Light Pink
          200: { value: "#fcc9ce" }, // Pink (Base)
          300: { value: "#f9a8b1" },
          400: { value: "#f68693" },
          500: { value: "#f26475" }, 
          600: { value: "#e83a4f" },
          700: { value: "#c22336" },
          800: { value: "#991928" },
          900: { value: "#70101b" },
          950: { value: "#4a0810" },
        },
        ivory: {
          50: { value: "#ffffff" },
          100: { value: "#fdfbf8" }, // White
          200: { value: "#f9f7f2" },
          300: { value: "#f2ede3" }, // Ivory (Base)
          400: { value: "#e8dfd1" },
          500: { value: "#ddcfbd" },
          600: { value: "#d3bfa8" },
          700: { value: "#5a6a8a" }, // Sage Green mapped to border/muted lines
          800: { value: "var(--c-ink)" },
          900: { value: "#7c6163" }, // Mauve/Brown for muted text
          950: { value: "#39425b" }, // Navy for darkest ink
        },
        /* State colors — semantic palette */
        state: {
          liked: { value: "#fcc9ce" },
          likedBg: { value: "#f7dcde" },
          star: { value: "#e3caa1" }, // Gold/Sand
          starBg: { value: "#f2ede3" },
          boost: { value: "#516642" }, // Olive Green
          boostBg: { value: "#5a6a8a" }, // Sage Green
        },
      },
      fonts: {
        heading: { value: '"Alex Brush", "Playfair Display", Georgia, serif' },
        body: { value: '"Plus Jakarta Sans", system-ui, sans-serif' },
      },
      radii: {
        card: { value: "16px" },
        button: { value: "24px" },
        input: { value: "12px" },
        chip: { value: "9999px" },
      },
    },
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: "{colors.brand.500}" },
          contrast: { value: "{colors.white}" },
          fg: { value: "{colors.brand.500}" },
          muted: { value: "{colors.brand.100}" },
          subtle: { value: "{colors.brand.50}" },
          emphasized: { value: "{colors.brand.200}" },
          focusRing: { value: "{colors.brand.400}" },
        },
        accent: {
          solid: { value: "{colors.pink.200}" },
          contrast: { value: "{colors.brand.900}" },
          fg: { value: "{colors.pink.500}" },
          muted: { value: "{colors.pink.100}" },
          subtle: { value: "{colors.pink.50}" },
        },
        bg: {
          canvas: { value: "{colors.ivory.300}" },
          surface: { value: "{colors.ivory.100}" },
          hero: { value: "{colors.ivory.200}" },
          elevated: { value: "{colors.ivory.100}" },
          input: { value: "{colors.ivory.200}" },
        },
        fg: {
          default: { value: "{colors.brand.900}" },
          muted: { value: "{colors.ivory.900}" },
          subtle: { value: "{colors.ivory.700}" },
        },
        border: {
          default: { value: "{colors.ivory.700}" },
          muted: { value: "{colors.ivory.500}" },
          subtle: { value: "{colors.ivory.400}" },
        },
      },
    },
  },
})

export const system = createSystem(defaultConfig, config)