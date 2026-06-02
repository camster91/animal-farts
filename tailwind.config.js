/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fredoka"', '"Comic Sans MS"', "system-ui", "sans-serif"],
      },
      animation: {
        shake: "shake 0.4s ease-in-out",
        poof: "poof 0.8s ease-out forwards",
        wiggle: "wiggle 0.6s ease-in-out infinite",
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translate(0,0) rotate(0)" },
          "20%": { transform: "translate(-8px, 4px) rotate(-2deg)" },
          "40%": { transform: "translate(8px, -4px) rotate(2deg)" },
          "60%": { transform: "translate(-6px, -2px) rotate(-1deg)" },
          "80%": { transform: "translate(6px, 2px) rotate(1deg)" },
        },
        poof: {
          "0%": { transform: "scale(0.5) translateY(0)", opacity: "1" },
          "100%": { transform: "scale(2) translateY(-120px)", opacity: "0" },
        },
        wiggle: {
          "0%, 100%": { transform: "rotate(-3deg)" },
          "50%": { transform: "rotate(3deg)" },
        },
      },
    },
  },
  plugins: [],
};
