/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        beige: {
          50: "#fcfbf9",
          100: "#f7f4ee",
          200: "#eee8dc",
          300: "#e2d8c5",
          400: "#cfc0a3",
          500: "#b5a281",
          600: "#968262",
          700: "#756449",
          800: "#544733",
          900: "#362d20",
        },
        sage: {
          50: "#f4f7f4",
          100: "#e6ede7",
          200: "#cbdccf",
          300: "#abc5b1",
          400: "#84a78c",
          500: "#60896a",
          600: "#486d51",
          700: "#37543e",
          800: "#273c2c",
          900: "#19281d",
        },
        forest: {
          800: "#1c382b",
          900: "#14291f",
          950: "#0c1b14",
        },
      },
    },
  },
  plugins: [],
}
