/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    fontFamily: {
      sans:    ['Inter', 'Outfit', 'sans-serif'],
      display: ['Outfit', 'Inter', 'sans-serif'],
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg:  `var(--radius)`,
        md:  `calc(var(--radius) - 2px)`,
        sm:  `calc(var(--radius) - 4px)`,
        xl:  `calc(var(--radius) + 4px)`,
        '2xl': `calc(var(--radius) + 8px)`,
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
        'gradient-accent':  'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%)',
        'gradient-hero':    'linear-gradient(135deg, hsl(var(--primary)/0.15) 0%, hsl(var(--accent)/0.08) 50%, transparent 100%)',
        'gradient-card':    'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)/0.5) 100%)',
      },
      boxShadow: {
        'glow-sm':    '0 0 8px -2px hsl(var(--primary)/0.35)',
        'glow-md':    '0 0 16px -4px hsl(var(--primary)/0.40), 0 4px 12px -4px hsl(var(--primary)/0.20)',
        'glow-lg':    '0 0 32px -8px hsl(var(--primary)/0.45), 0 8px 24px -8px hsl(var(--primary)/0.25)',
        'glow-accent':'0 0 16px -4px hsl(var(--accent)/0.45)',
        'card-hover': '0 12px 40px -8px hsl(var(--primary)/0.22), 0 4px 12px -4px hsl(var(--primary)/0.10)',
        'card-float': '0 20px 60px -12px hsl(var(--foreground)/0.12), 0 4px 16px -4px hsl(var(--foreground)/0.06)',
        'inner-glow': 'inset 0 1px 0 hsl(var(--primary)/0.15)',
      },
      transitionTimingFunction: {
        'spring':  'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'premium': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'snappy':  'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      keyframes: {
        /* ── entrance ── */
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.93)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceIn: {
          '0%':   { opacity: '0', transform: 'scale(0.8) translateY(8px)' },
          '60%':  { transform: 'scale(1.04) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        slideInLeft: {
          '0%':   { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        /* ── decorative ── */
        shimmer: {
          '0%':   { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-10px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px hsl(var(--primary)/0.30)' },
          '50%':       { boxShadow: '0 0 24px hsl(var(--primary)/0.60), 0 0 48px hsl(var(--primary)/0.20)' },
        },
        gradientShift: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        pulseRing: {
          '0%':   { transform: 'scale(0.9)', opacity: '0.8' },
          '70%':  { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        iconPop: {
          '0%':   { transform: 'scale(1)' },
          '50%':  { transform: 'scale(1.18) rotate(-5deg)' },
          '100%': { transform: 'scale(1)' },
        },
        blob1: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':       { transform: 'translate(4%,3%) scale(1.06)' },
          '66%':       { transform: 'translate(-3%,5%) scale(0.97)' },
        },
        blob2: {
          '0%, 100%': { transform: 'translate(0,0) scale(1)' },
          '33%':       { transform: 'translate(-5%,-3%) scale(1.05)' },
          '66%':       { transform: 'translate(3%,-5%) scale(0.98)' },
        },
        floatOrb: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)',   opacity: '0.3' },
          '50%':       { transform: 'translateY(-30px) scale(1.06)', opacity: '0.5' },
        },
      },
      animation: {
        'slide-up':      'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in':       'fadeIn 0.5s ease-out forwards',
        'scale-in':      'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'bounce-in':     'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both',
        'slide-left':    'slideInLeft 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-right':   'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shimmer':       'shimmer 2s linear infinite',
        'float':         'float 4s ease-in-out infinite',
        'glow-pulse':    'glowPulse 2.5s ease-in-out infinite',
        'gradient':      'gradientShift 5s ease infinite',
        'pulse-ring':    'pulseRing 1.5s ease-out infinite',
        'icon-pop':      'iconPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'blob1':         'blob1 14s ease-in-out infinite',
        'blob2':         'blob2 18s ease-in-out infinite',
        'float-orb':     'floatOrb 10s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
