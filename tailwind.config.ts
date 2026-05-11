import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        body: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Sora", "DM Sans", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      screens: {
        xs: "475px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      colors: {
        // Shift core surfaces toward neutral blacks (less navy/blue cast).
        tsBg: "#050505",
        tsCard: "#111111",
        tsSurface: "#1A1A1A",
        tsBorder: "rgba(255, 255, 255, 0.1)",
        tsAccent: "#f97316",
        tsAccentSoft: "#fb923c",
        tsTextMain: "#FAFAFA",
        tsTextMuted: "#71717A",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // TradeScout specific colors
        "navy-900": "#0a0f1e",
        "navy-800": "#0f172a",
        "navy-700": "#1e293b",
        "navy-600": "#334155",
        "navy-500": "#475569",

        "orange-500": "#f97316",
        "orange-600": "#ea580c",
        "orange-400": "#fb923c",
        "ts-orange": "#f97316",
        "ts-orange-light": "#fb923c",
        "ts-orange-dark": "#ea580c",
        "ts-navy": "#0f172a",
        "ts-navy-deep": "#0a0f1e",
        "ts-navy-light": "#1e293b",

        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
