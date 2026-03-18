import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1e3a5f',
          light: '#2d5a87',
          dark: '#0f172a',
        },
        secondary: {
          DEFAULT: '#c9a227',
          light: '#d4b44a',
          dark: '#a88a1f',
        },
        card: '#1e293b',
        border: '#334155',
      },
    },
  },
  plugins: [],
}
export default config
