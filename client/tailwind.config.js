/** @type {import('tailwindcss').Config} */
// Due Diligence Portal — TracTrac colours (due-diligence-final/FINAL.md).
// Accessibility: orange buttons carry ink text (never white); orange is never used for text;
// `stone` secondary text only on white or sand-50; focus ring is 3px ink with a 2px offset.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      fontSize: {
        12: ['12px', '1.5'],
        13: ['13px', '1.5'],
        14: ['14px', '1.5'],
        15: ['15px', '1.5'],
        16: ['16px', '1.5'],
        17: ['17px', '1.5'],
        18: ['18px', '1.5'],
        22: ['22px', '1.4'],
        24: ['24px', '1.4'],
        28: ['28px', '1.2'],
      },
      colors: {
        brand: { DEFAULT: '#F36A02', light: '#F79A5B' }, // buttons, progress, top stripes, checkmarks
        sand: {
          DEFAULT: '#DCD6CD', // borders, progress track, disabled buttons
          50: '#F5F2EE', // page background
          line: '#EFEBE6', // dividers between rows (tint of sand, from the final designs)
          hover: '#FBFAF8', // row hover (tint of sand, from the final designs)
        },
        ink: '#14110F', // all text, links, logo tile, focus ring
        stone: '#6E6A65', // secondary text, input underlines, outline-button borders
        error: '#B42318', // required * and error messages only
      },
      borderRadius: {
        control: '8px',
      },
      boxShadow: {
        lg: '0 12px 32px rgba(20,17,15,.18)',
        selected: 'inset 0 0 0 2px #F36A02',
      },
    },
  },
  plugins: [],
};
