/** Sentinel design tokens — dark glassmorphic theme */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Core surface palette - Swiss Minimalist Light
        bg: "#F9FAFB",
        card: "#FFFFFF",
        ink: "#111827",
        muted: "#6B7280",
        line: "#E5E7EB",
        // Brand & Accents
        brand: "#0F172A",
        "brand-dark": "#020617",
        accent: "#2563EB",
        "accent-dark": "#1D4ED8",
        // Severity scale (elegant semantic)
        critical: "#DC2626",
        high: "#EA580C",
        medium: "#CA8A04",
        low: "#059669",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        heading: ["Outfit", "Inter", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s infinite',
        'glow-sweep': 'glowSweep 3s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: 1, boxShadow: '0 0 15px rgba(108, 29, 69, 0.5)' },
          '50%': { opacity: 0.8, boxShadow: '0 0 5px rgba(108, 29, 69, 0.2)' },
        },
        glowSweep: {
          '0%': { backgroundPosition: '200% 50%' },
          '100%': { backgroundPosition: '-200% 50%' },
        }
      }
    },
  },
  plugins: [],
};
