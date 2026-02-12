import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

// Tailwind v3 configuration
const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    // Root wildcard removed per Vercel recommendation for better content scanning
  ],
  theme: {
    extend: {
      colors: {
        background: 'oklch(var(--background))',
        foreground: 'oklch(var(--foreground))',
        card: {
          DEFAULT: 'oklch(var(--card))',
          foreground: 'oklch(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'oklch(var(--popover))',
          foreground: 'oklch(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'oklch(var(--primary))',
          foreground: 'oklch(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'oklch(var(--secondary))',
          foreground: 'oklch(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'oklch(var(--muted))',
          foreground: 'oklch(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'oklch(var(--accent))',
          foreground: 'oklch(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'oklch(var(--destructive))',
          foreground: 'oklch(var(--destructive-foreground))',
        },
        border: 'oklch(var(--border))',
        input: 'oklch(var(--input))',
        ring: 'oklch(var(--ring))',
        chart: {
          1: 'oklch(var(--chart-1))',
          2: 'oklch(var(--chart-2))',
          3: 'oklch(var(--chart-3))',
          4: 'oklch(var(--chart-4))',
          5: 'oklch(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'oklch(var(--sidebar-background))',
          foreground: 'oklch(var(--sidebar-foreground))',
          primary: 'oklch(var(--sidebar-primary))',
          'primary-foreground': 'oklch(var(--sidebar-primary-foreground))',
          accent: 'oklch(var(--sidebar-accent))',
          'accent-foreground': 'oklch(var(--sidebar-accent-foreground))',
          border: 'oklch(var(--sidebar-border))',
          ring: 'oklch(var(--sidebar-ring))',
        },
        // Bold Athletic Minimalism Colors
        neon: {
          cyan: 'oklch(var(--neon-cyan))',
          yellow: 'oklch(var(--neon-yellow))',
          pink: 'oklch(var(--neon-pink))',
        },
        athletic: {
          black: 'oklch(var(--black))',
          gray: {
            900: 'oklch(var(--gray-900))',
            800: 'oklch(var(--gray-800))',
            700: 'oklch(var(--gray-700))',
            100: 'oklch(var(--gray-100))',
          },
          white: 'oklch(var(--white))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        'athletic-sm': 'var(--radius-sm)',
        'athletic-md': 'var(--radius-md)',
        'athletic-lg': 'var(--radius-lg)',
        'athletic-xl': 'var(--radius-xl)',
        'athletic-full': 'var(--radius-full)',
      },
      spacing: {
        'xs': 'var(--space-xs)',
        'sm': 'var(--space-sm)',
        'md': 'var(--space-md)',
        'lg': 'var(--space-lg)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
      },
      transitionTimingFunction: {
        'out-quart': 'var(--ease-out-quart)',
        'out-expo': 'var(--ease-out-expo)',
        'in-out': 'var(--ease-in-out)',
      },
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        'slide-in-right': {
          'from': { transform: 'translateX(20px)', opacity: '0' },
          'to': { transform: 'translateX(0)', opacity: '1' },
        },
        'morph': {
          'from': { borderRadius: '1rem' },
          'to': { borderRadius: '2rem' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'morph': 'morph 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;

