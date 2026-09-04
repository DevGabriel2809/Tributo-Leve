import type { Config } from "tailwindcss"

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Asap Sharp"', "system-ui", "sans-serif"], slab: ['"Roboto Slab"', "Georgia", "serif"] },
      colors: { ink: "#101310", paper: "#f2f4ef", mint: "#c9ffc1", acid: "#f2eb38" },
      boxShadow: { float: "0 24px 80px rgba(12, 18, 13, .14)", lift: "0 12px 0 rgba(16, 19, 16, .10)" }
    }
  },
  plugins: []
} satisfies Config
