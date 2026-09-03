import type { Config } from 'tailwindcss'

/**
 * Tokens espelham design/design-tokens.md. As cores apontam para as CSS vars
 * definidas em src/styles/tokens.css (fonte única de verdade, herdada do protótipo).
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class', // app é dark-only na Fase 1: <html class="dark">
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          'elevated-2': 'var(--bg-elevated-2)',
        },
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          'on-accent': 'var(--text-on-accent)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          surface: 'var(--accent-surface)',
          // "tinta" do acento p/ TEXTO/ícones sobre a superfície da página: = acento no escuro,
          // escurecido no claro (o amarelo puro não lê em fundo branco). Ver ThemeApplier.
          ink: 'var(--accent-ink)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,.4)',
        pop: '0 12px 40px rgba(0,0,0,.6)',
        glow: '0 0 0 2px var(--accent), 0 0 32px rgba(250,204,21,.45)',
        fab: '0 8px 24px rgba(250,204,21,.35)',
      },
      keyframes: {
        popIn: {
          '0%': { opacity: '0', transform: 'scale(.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        overlayPulse: {
          '0%,100%': { boxShadow: '0 0 0 2px var(--accent), 0 0 24px rgba(250,204,21,.30), 0 24px 60px rgba(0,0,0,.7)' },
          '50%': { boxShadow: '0 0 0 3px var(--accent-soft), 0 0 56px rgba(250,204,21,.65), 0 24px 60px rgba(0,0,0,.7)' },
        },
        shakeX: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-9px)' },
          '40%': { transform: 'translateX(8px)' },
          '60%': { transform: 'translateX(-5px)' },
          '80%': { transform: 'translateX(3px)' },
        },
      },
      animation: {
        popIn: 'popIn .3s cubic-bezier(.16,1,.3,1) both',
        fadeUp: 'fadeUp .35s cubic-bezier(.16,1,.3,1) both',
      },
    },
  },
  plugins: [],
} satisfies Config
