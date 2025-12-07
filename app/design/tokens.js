/**
 * Design System Tokens
 * Museum-quality curation meets modern digital interface
 *
 * Philosophy: Clean, art-forward collector's gallery with PS2-era sophistication
 */

export const tokens = {
  colors: {
    // Primary: Museum Gallery Darks
    bg: {
      primary: "#0a0e14",
      elevated: "#14181f",
      glass: "rgba(20, 24, 31, 0.85)",
    },

    // Accent: Refined Teal + PS2 Blue
    accent: {
      primary: "#00d4ff", // Bright cyan (PS2 startup vibes)
      secondary: "#6366f1", // Indigo (collection depth)
      warm: "#f59e0b", // Amber for owned/highlights
    },

    // Text: High Contrast Hierarchy
    text: {
      primary: "#ffffff",
      secondary: "#a1a8b8",
      muted: "#6b7280",
    },

    // Status Colors (game conditions)
    status: {
      owned: "#10b981", // Green - owned
      wishlist: "#f59e0b", // Amber - want
      backlog: "#6366f1", // Indigo - to play
      trade: "#8b5cf6", // Purple - trading
    },
  },

  spacing: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "48px",
    xxl: "64px",
  },

  typography: {
    display: {
      family: "'Rajdhani', 'Inter', system-ui",
      size: "32px",
      weight: 700,
    },
    body: {
      family: "'Inter', system-ui",
      size: "16px",
      weight: 400,
    },
    accent: {
      family: "'Space Mono', monospace",
      size: "14px",
      weight: 400,
    },
  },

  shadows: {
    sm: "0 2px 4px rgba(0, 0, 0, 0.1)",
    md: "0 4px 12px rgba(0, 0, 0, 0.15)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.2)",
    xl: "0 16px 48px rgba(0, 0, 0, 0.3)",
    glow: "0 0 20px rgba(0, 212, 255, 0.3)",
  },

  animation: {
    duration: {
      fast: "0.2s",
      medium: "0.4s",
      slow: "0.6s",
    },
    easing: {
      default: "cubic-bezier(0.4, 0, 0.2, 1)",
      in: "cubic-bezier(0.4, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.2, 1)",
      bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
    },
  },

  breakpoints: {
    mobile: "320px",
    tablet: "768px",
    desktop: "1024px",
    wide: "1440px",
  },

  borderRadius: {
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
};

/**
 * Convert tokens to CSS custom properties
 */
export function generateCSSVariables() {
  const cssVars = [];

  // Colors
  cssVars.push("/* Primary: Museum Gallery Darks */");
  cssVars.push(`--bg-primary: ${tokens.colors.bg.primary};`);
  cssVars.push(`--bg-elevated: ${tokens.colors.bg.elevated};`);
  cssVars.push(`--bg-glass: ${tokens.colors.bg.glass};`);

  cssVars.push("\n/* Accent: Refined Teal + PS2 Blue */");
  cssVars.push(`--accent-primary: ${tokens.colors.accent.primary};`);
  cssVars.push(`--accent-secondary: ${tokens.colors.accent.secondary};`);
  cssVars.push(`--accent-warm: ${tokens.colors.accent.warm};`);

  cssVars.push("\n/* Text: High Contrast Hierarchy */");
  cssVars.push(`--text-primary: ${tokens.colors.text.primary};`);
  cssVars.push(`--text-secondary: ${tokens.colors.text.secondary};`);
  cssVars.push(`--text-muted: ${tokens.colors.text.muted};`);

  cssVars.push("\n/* Status Colors */");
  cssVars.push(`--status-owned: ${tokens.colors.status.owned};`);
  cssVars.push(`--status-wishlist: ${tokens.colors.status.wishlist};`);
  cssVars.push(`--status-backlog: ${tokens.colors.status.backlog};`);
  cssVars.push(`--status-trade: ${tokens.colors.status.trade};`);

  cssVars.push("\n/* Spacing */");
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    cssVars.push(`--spacing-${key}: ${value};`);
  });

  cssVars.push("\n/* Typography */");
  cssVars.push(`--font-display: ${tokens.typography.display.family};`);
  cssVars.push(`--font-body: ${tokens.typography.body.family};`);
  cssVars.push(`--font-accent: ${tokens.typography.accent.family};`);

  cssVars.push("\n/* Shadows */");
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    cssVars.push(`--shadow-${key}: ${value};`);
  });

  cssVars.push("\n/* Animation */");
  cssVars.push(`--duration-fast: ${tokens.animation.duration.fast};`);
  cssVars.push(`--duration-medium: ${tokens.animation.duration.medium};`);
  cssVars.push(`--duration-slow: ${tokens.animation.duration.slow};`);
  cssVars.push(`--easing-default: ${tokens.animation.easing.default};`);

  cssVars.push("\n/* Border Radius */");
  Object.entries(tokens.borderRadius).forEach(([key, value]) => {
    cssVars.push(`--radius-${key}: ${value};`);
  });

  return cssVars.join("\n  ");
}
