/** Colors come from CSS variables (src/index.css) so the theme lives in one place. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: v('primary'), dark: v('primary-dark'), bright: v('primary-bright') },
        secondary: v('secondary'),
        accent: v('accent'),
        lightblue: v('light-blue'),
        softpink: v('soft-pink'),
        ink: v('text'),
        muted: v('muted'),
        line: v('border'),
        success: v('success'),
        warn: v('warn'),
        danger: v('danger'),
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 1px 2px rgb(9 49 141 / 0.05), 0 6px 20px rgb(9 49 141 / 0.06)' },
      borderRadius: { xl2: '1rem' },
    },
  },
  plugins: [],
};
