/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        phantom: {
          bg: "#1a1a1a",
          card: "#252525",
          border: "#333",
          accent: "#ab9ff2",
          text: "#e8e8e8",
          muted: "#888",
        },
      },
    },
  },
  plugins: [],
};
