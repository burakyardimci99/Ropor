import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        // AI LAB brand palette (blue)
        brand: {
          blue: "#2DA8FF",
          bright: "#5BC0FF",
          deep: "#0B63C4",
          navy: "#0A1430",
          ink: "#EAF4FF",
        },
        good: { DEFAULT: "#34D399", deep: "#059669" },
        warn: { DEFAULT: "#FBBF24", deep: "#D97706" },
      },
    },
  },
  plugins: [],
};

export default config;
