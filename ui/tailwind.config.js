/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#007EA7",
          dark: "#003459",
          darker: "#00171F",
          light: "#0093C8",
        },
        accent: {
          DEFAULT: "#FCA311",
        },
        background: {
          DEFAULT: "#E5E5E5",
        }
      }
    },
  },
  plugins: [],
}
