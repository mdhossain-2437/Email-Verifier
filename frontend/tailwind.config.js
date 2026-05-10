/**
 * Tailwind design tokens for Email Verifier.
 *
 * Sub-brand of delowarhossain.dev: lime accent on near-black surfaces, with
 * Space Grotesk for display, Inter for body, JetBrains Mono for caption / code.
 *
 * Tokens stay synced with `src/index.css` (which mirrors them as CSS variables)
 * so they can be referenced from inline style attributes when needed.
 */

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        lime: {
          DEFAULT: "#c3f400",
          50: "#f4fcd6",
          100: "#e9faaf",
          200: "#d9f773",
          300: "#cdf52e",
          400: "#c3f400",
          500: "#a3cd00",
          600: "#7e9d00",
          700: "#5f7600",
          800: "#404f00",
          900: "#202700",
        },
        // Surfaces (mirrored to CSS vars in index.css)
        ink: {
          DEFAULT: "#0e0e0e",
          50: "#1c1b1b",
          100: "#131313",
          200: "#0e0e0e",
          900: "#050505",
        },
        // Hairline / dividers
        hairline: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          strong: "rgba(255, 255, 255, 0.14)",
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      letterSpacing: {
        tightest: "-0.04em",
        tighter: "-0.025em",
      },
      fontSize: {
        // Editorial display ramp — Space Grotesk, tightest tracking.
        // Names match the role, not Tailwind's t-shirt sizes.
        "display-2xl": ["clamp(3rem, 6vw + 1rem, 7rem)", { lineHeight: "0.95", letterSpacing: "-0.04em" }],
        "display-xl": ["clamp(2.5rem, 5vw + 0.5rem, 5rem)", { lineHeight: "0.98", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(2rem, 4vw + 0.5rem, 3.5rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-md": ["clamp(1.625rem, 3vw + 0.25rem, 2.5rem)", { lineHeight: "1.08", letterSpacing: "-0.025em" }],
        "display-sm": ["clamp(1.375rem, 2vw + 0.25rem, 1.875rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(195, 244, 0, 0.25), 0 12px 36px -8px rgba(195, 244, 0, 0.18)",
        "edge-soft": "0 1px 0 0 rgba(255, 255, 255, 0.06) inset, 0 18px 60px -32px rgba(0, 0, 0, 0.8)",
        card: "0 1px 0 0 rgba(255, 255, 255, 0.04) inset, 0 24px 80px -48px rgba(0, 0, 0, 0.9)",
      },
      transitionTimingFunction: {
        editorial: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        hover: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      animation: {
        "pulse-soft": "pulseSoft 1.6s ease-in-out infinite",
        "rise-in": "riseIn 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
        "fade-in": "fadeIn 500ms ease-out both",
        shimmer: "shimmer 1.6s linear infinite",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        riseIn: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        shimmer: {
          from: { backgroundPosition: "-200% 0" },
          to: { backgroundPosition: "200% 0" },
        },
      },
      maxWidth: {
        prose: "65ch",
        shell: "1280px",
      },
    },
  },
  plugins: [import("tailwindcss-animate")],
};
