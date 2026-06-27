import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        page: "var(--page)",
        pageWarm: "var(--page-warm)",
        surface: "var(--surface)",
        surfaceSoft: "var(--surface-soft)",
        surfaceMuted: "var(--surface-muted)",
        surfaceHover: "var(--surface-hover)",
        border: "var(--border)",
        borderStrong: "var(--border-strong)",
        primary: "var(--text-primary)",
        secondary: "var(--text-secondary)",
        muted: "var(--text-muted)",
        focus: "var(--focus-accent)",
        focusDark: "var(--focus-accent-dark)",
        break: "var(--break-accent)",
        breakDark: "var(--break-accent-dark)",
        alert: "var(--alert-accent)",
        alertDark: "var(--alert-accent-dark)",
        redSoft: "var(--accent-red-soft)",
        neutralSoft: "var(--neutral-soft)"
      },
      boxShadow: {
        subtle: "0 8px 18px rgba(70, 59, 44, 0.05)"
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
        small: "var(--radius-small)"
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"]
      }
    }
  },
  plugins: []
};

export default config;
