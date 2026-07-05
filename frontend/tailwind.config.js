/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        severity: {
          1: "#22c55e",
          2: "#84cc16",
          3: "#eab308",
          4: "#f97316",
          5: "#ef4444",
        },
      },
    },
  },
  plugins: [],
};
