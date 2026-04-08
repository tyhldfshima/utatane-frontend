import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        forest:  '#1B3A2D',
        moss:    '#2D5A45',
        sprout:  '#5DA67E',
        amber:   '#C47B2B',
        gold:    '#E8A83E',
        cream:   '#F7F2E8',
        paper:   '#FBF8F2',
        ink:     '#1A1612',
        // 役割バッジ固定色
        role: {
          composer:  '#534AB7',
          lyricist:  '#1D9E75',
          musician:  '#D85A30',
        },
      },
      borderRadius: {
        sm:   '8px',
        md:   '12px',
        lg:   '16px',
        xl:   '20px',
      },
      boxShadow: {
        card: '0 1px 4px rgba(0,0,0,.06)',
      },
    },
  },
  plugins: [],
}

export default config
