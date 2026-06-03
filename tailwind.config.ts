import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        soil: "#6f4b2f",
        leaf: "#286c4a",
        harvest: "#d78b2d",
        paper: "#fffaf1",
        ink: "#1f2933"
      },
      boxShadow: {
        soft: "0 16px 40px rgba(37, 47, 63, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;

