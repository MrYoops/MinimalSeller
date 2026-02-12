/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // MinimalMod Design System Colors
        'mm-black': '#121212',
        'mm-darker': '#0a0a0a',
        'mm-dark': '#1E1E1E',
        'mm-gray': '#2A2A2A',
        'mm-border': '#424242',
        'mm-text': '#FFFFFF',
        'mm-text-secondary': '#BDBDBD',
        'mm-text-tertiary': '#9E9E9E',
        // Neon accent colors
        'mm-cyan': '#00FFFF',
        'mm-purple': '#9370DB',
        'mm-green': '#00FF7F',
        'mm-red': '#FF4500',
        'mm-yellow': '#FFD700',
        'mm-blue': '#00BFFF',
      },
      fontFamily: {
        'mono': ['Fira Code', 'Roboto Mono', 'Courier New', 'monospace'],
        'sans': ['Inter', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0, 255, 255, 0.5)',
        'neon-purple': '0 0 10px rgba(147, 112, 219, 0.5)',
        'neon-green': '0 0 10px rgba(0, 255, 127, 0.5)',
      },
    },
  },
  plugins: [],
}