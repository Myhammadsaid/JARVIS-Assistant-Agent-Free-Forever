module.exports = {
  content: [
    "./src/renderer/**/*.{js,jsx,ts,tsx}",
    "./index.html"
  ],
  theme: {
    extend: {
      colors: {
        jarvis: {
          cyan: '#00f3ff',
          dark: '#050a0f',
          panel: '#0a1520',
          red: '#ff2a2a',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}