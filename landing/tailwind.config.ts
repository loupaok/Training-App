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
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
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
