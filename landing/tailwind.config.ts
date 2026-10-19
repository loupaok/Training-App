import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#0d1f3c",
          50: "#eef1f6",
          100: "#d4dbe8",
          200: "#a9b7d1",
          300: "#7e93ba",
          400: "#536fa3",
          500: "#2f4f87",
          600: "#1c3763",
          700: "#152a4c",
          800: "#0d1f3c",
          900: "#070f1e",
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
      },
      animation: {
        "fade-up": "fade-up 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
