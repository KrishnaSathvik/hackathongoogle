import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Earthy national park palette
        terrain: {
          50: "#faf6f1",
          100: "#f0e8db",
          200: "#e0d0b5",
          300: "#cdb389",
          400: "#be9968",
          500: "#b3854f",
          600: "#a67244",
          700: "#8a5a39",
          800: "#714a34",
          900: "#5d3e2d",
          950: "#331f16",
        },
        forest: {
          50: "#f0f7f1",
          100: "#dcedde",
          200: "#bbdbc0",
          300: "#8ec298",
          400: "#5fa56e",
          500: "#3d8750",
          600: "#2c6b3e",
          700: "#245633",
          800: "#1f452b",
          900: "#1a3924",
          950: "#0d2014",
        },
        sky: {
          50: "#f0f6fe",
          100: "#ddeafc",
          200: "#c3dbfa",
          300: "#9ac4f6",
          400: "#6aa5ef",
          500: "#4785e8",
          600: "#3268dc",
          700: "#2953ca",
          800: "#2845a4",
          900: "#253d82",
          950: "#1b274f",
        },
        slate: {
          850: "#1a2332",
          925: "#111827",
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', "Georgia", "serif"],
        body: ['"Source Sans 3"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.8s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "slide-in": "slideIn 0.6s ease-out forwards",
        pulse_slow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
