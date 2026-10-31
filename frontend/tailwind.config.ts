import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border-hair)",
        input: "var(--border-hair)",
        ring: "var(--brand-primary)",
        background: "var(--bg-app)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--brand-primary)",
          foreground: "var(--brand-primary-fg)",
        },
        secondary: {
          DEFAULT: "var(--brand-tint)",
          foreground: "var(--brand-text)",
        },
        destructive: {
          DEFAULT: "var(--danger-bg)",
          foreground: "var(--danger-fg)",
        },
        muted: {
          DEFAULT: "var(--bg-muted)",
          foreground: "var(--text-muted)",
        },
        accent: {
          yellow: {
            DEFAULT: "var(--accent-hero-yellow)",
            foreground: "var(--accent-hero-yellow-fg)",
          },
          blue: {
            DEFAULT: "var(--accent-hero-blue)",
            foreground: "var(--accent-hero-blue-fg)",
          },
          purple: {
            DEFAULT: "var(--accent-hero-purple)",
            foreground: "var(--accent-hero-purple-fg)",
          },
        },
        surface: {
          DEFAULT: "var(--bg-surface)",
          hover: "var(--bg-surface-hover)",
        },
        info: {
          DEFAULT: "var(--info-bg)",
          foreground: "var(--info-fg)",
        },
        warning: {
          DEFAULT: "var(--warning-bg)",
          foreground: "var(--warning-fg)",
        },
        success: {
          DEFAULT: "var(--brand-primary)",
          foreground: "var(--brand-primary-fg)",
        },
      },
      borderColor: {
        DEFAULT: "var(--border-hair)",
        faint: "var(--border-faint)",
        dashed: "var(--border-dashed)",
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config