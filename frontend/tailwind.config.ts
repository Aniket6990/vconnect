import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        app_purple: "#A59BFC",
        app_grey: "#8E8D93",
        app_red: "#F62549",
        app_bg: "#F4F2F2",
        light: "#FFFFFF",
        dark: "#000000",
      },
    },
  },
  plugins: [],
};
export default config;
