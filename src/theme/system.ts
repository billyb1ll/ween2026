import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react"

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          50: { value: "#f0f7f8" },
          100: { value: "#cce7ed" },
          200: { value: "#b0cbd1" },
          300: { value: "#7fa6ad" },
          400: { value: "#5f8a92" },
          500: { value: "#496268" },
          600: { value: "#3d5357" },
          700: { value: "#324b50" },
          800: { value: "#283d41" },
          900: { value: "#1e2f32" },
          950: { value: "#041f24" },
        },
        chocolate: {
          50: { value: "#fdf6f2" },
          100: { value: "#fae8db" },
          200: { value: "#ffe2d2" },
          300: { value: "#eebca0" },
          400: { value: "#c49070" },
          500: { value: "#7c563f" },
          600: { value: "#6b4a36" },
          700: { value: "#613f29" },
          800: { value: "#4a2f1f" },
          900: { value: "#2f1504" },
          950: { value: "#1a0b02" },
        },
        ivory: {
          50: { value: "#ffffff" },
          100: { value: "#fcf9f8" },
          200: { value: "#f6f3f2" },
          300: { value: "#f0eded" },
          400: { value: "#eae7e7" },
          500: { value: "#e4e2e1" },
          600: { value: "#dcd9d9" },
          700: { value: "#c2c7c9" },
          800: { value: "var(--c-ink)" },
          900: { value: "#424849" },
          950: { value: "#1b1c1c" },
        },
        /* State colors — semantic palette */
        state: {
          liked: { value: "#c0392b" },
          likedBg: { value: "#fce8e6" },
          star: { value: "#496268" },
          starBg: { value: "#c5e0e6" },
          boost: { value: "#7c563f" },
          boostBg: { value: "#ffe2d2" },
        },
      },
      fonts: {
        heading: { value: '"Playfair Display", Georgia, serif' },
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
          solid: { value: "{colors.chocolate.500}" },
          contrast: { value: "{colors.ivory.100}" },
          fg: { value: "{colors.chocolate.500}" },
          muted: { value: "{colors.chocolate.200}" },
          subtle: { value: "{colors.chocolate.50}" },
        },
        bg: {
          canvas: { value: "{colors.ivory.100}" },
          surface: { value: "{colors.white}" },
          hero: { value: "{colors.ivory.200}" },
          elevated: { value: "{colors.ivory.300}" },
          input: { value: "{colors.ivory.300}" },
        },
        fg: {
          default: { value: "{colors.ivory.950}" },
          muted: { value: "{colors.ivory.900}" },
          subtle: { value: "{colors.ivory.800}" },
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