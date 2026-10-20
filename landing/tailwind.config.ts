import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0b0b0b",
          50: "#f5f5f5",
          100: "#e6e6e6",
          200: "#cccccc",
          300: "#a3a3a3",
          400: "#737373",
          500: "#525252",
          600: "#3a3a3a",
          700: "#262626",
          800: "#171717",
          900: "#0b0b0b",
          950: "#000000",
        },
        lime: {
          DEFAULT: "#B1F90C",
          50: "#f6ffe0",
          100: "#eaffb0",
          200: "#ddff80",
          300: "#cdfb4d",
          400: "#bdf52f",
          500: "#B1F90C",
          600: "#8fcb09",
          700: "#6c9b07",
          800: "#4a6c05",
          900: "#283c02",
        },
      },
      fontFamily: {
        sans: ["var(--font-commissioner)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        // H1 — hero (mobile base, -d = desktop override via lg: variant)
        h1: ["50px", { lineHeight: "0.92", letterSpacing: "-1.5px", fontWeight: "800" }],
        "h1-d": ["72px", { lineHeight: "0.95", letterSpacing: "-2px", fontWeight: "800" }],
        // H2 bold — brand titles
        h2b: ["48px", { lineHeight: "0.92", letterSpacing: "-1px", fontWeight: "800" }],
        "h2b-d": ["88px", { lineHeight: "0.92", letterSpacing: "-2px", fontWeight: "800" }],
        // H2 light — section titles
        h2l: ["34px", { lineHeight: "1.05", letterSpacing: "-1px", fontWeight: "300" }],
        "h2l-d": ["64px", { lineHeight: "1.05", letterSpacing: "-2px", fontWeight: "300" }],
        // H3 — card titles
        h3: ["19px", { lineHeight: "1.3", fontWeight: "600" }],
        "h3-d": ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        // Eyebrow — small label above titles
        eyebrow: ["12px", { lineHeight: "1.2", letterSpacing: "4px", fontWeight: "700" }],
        "eyebrow-d": ["14px", { lineHeight: "1.2", letterSpacing: "6px", fontWeight: "700" }],
        // Lead — body large (hero subtitle)
        lead: ["16px", { lineHeight: "1.55", fontWeight: "400" }],
        "lead-d": ["20px", { lineHeight: "1.55", fontWeight: "400" }],
        // Body
        body: ["15px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-d": ["17px", { lineHeight: "1.6", fontWeight: "400" }],
        // Small text — lists, pricing features
        xsmall: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        // Labels / captions
        label: ["12px", { lineHeight: "1.3", fontWeight: "700" }],
        // Stat numbers
        stat: ["30px", { lineHeight: "1.1", fontWeight: "800" }],
        // Prices
        price: ["44px", { lineHeight: "1", letterSpacing: "-1.5px", fontWeight: "300" }],
        "price-d": ["52px", { lineHeight: "1", letterSpacing: "-1.5px", fontWeight: "300" }],
        // Nav links
        navlink: ["15px", { lineHeight: "1.4", fontWeight: "500" }],
      },
      maxWidth: {
        "8xl": "90rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
