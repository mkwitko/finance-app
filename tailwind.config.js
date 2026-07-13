/** @type {import('tailwindcss').Config} */
const withAlpha = (v) => `rgb(var(${v}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: withAlpha("--bg"), elevated: withAlpha("--bg-elevated") },
        fg: { DEFAULT: withAlpha("--fg"), secondary: withAlpha("--fg-secondary") },
        border: withAlpha("--border"),
        accent: { DEFAULT: withAlpha("--accent"), fg: withAlpha("--accent-fg") },
        income: withAlpha("--income"),
        expense: withAlpha("--expense"),
        warning: withAlpha("--warning"),
        investment: withAlpha("--investment"),
        neutral: withAlpha("--neutral"),
      },
    },
  },
  plugins: [],
};
