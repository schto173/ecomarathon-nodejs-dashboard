/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        shell: {
          yellow: '#FBCE07',
          red: '#DD1D21',
        },
      },
    },
  },
  plugins: [],
}
