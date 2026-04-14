/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/mainview/**/*.{html,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#7a5af8",
          "purple-dark": "#5925dc",
          blue: "#447aff",
          "blue-light": "#9bb4ff",
          pink: "#ee46bc",
          navy: "#172b4d",
        },
        surface: {
          DEFAULT: "#ffffff",
          mist: "#f8f7ff",
          violet: "#f0eeff",
          info: "#d7defa",
        },
        gray: {
          300: "#d0d5dd",
          400: "#98a2b3",
          500: "#6b778c",
          700: "#475467",
        },
        accent: {
          teal: "#54c9c2",
          "teal-dark": "#38b2ab",
        },
        success: "#22a861",
        warning: "#ffc400",
        danger: "#d0021b",
      },
      fontFamily: {
        display: ["Waldenburg", "Waldenburg Fallback", "system-ui", "sans-serif"],
        "display-bold": ["WaldenburgFH", "WaldenburgFH Fallback", "system-ui", "sans-serif"],
        sans: ["Inter", "Inter Fallback", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "16px",
        xl: "24px",
        soft: "30px",
        pill: "9999px",
      },
      boxShadow: {
        none: "none",
      },
    },
  },
  plugins: [],
};
