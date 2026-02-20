/**
 * Enterprise Theme Configuration — ANTIGRAVITY
 * Programmatic access to design tokens.
 * CSS variables are the source of truth (globals.css).
 * This file provides TypeScript constants for use in JS/chart configs.
 */

export const theme = {
  colors: {
    primary:          "var(--primary)",
    primaryHover:     "var(--primary-hover)",
    primaryForeground:"var(--primary-foreground)",

    accent:           "var(--accent)",
    accentHover:      "var(--accent-hover)",
    accentForeground: "var(--accent-foreground)",
    accentMuted:      "var(--accent-muted)",

    background:       "var(--background)",
    foreground:       "var(--foreground)",
    surface:          "var(--surface)",
    surfaceRaised:    "var(--surface-raised)",
    surfaceMuted:     "var(--surface-muted)",

    card:             "var(--card)",
    cardForeground:   "var(--card-foreground)",
    cardBorder:       "var(--card-border)",

    border:           "var(--border)",
    borderSubtle:     "var(--border-subtle)",
    input:            "var(--input)",
    inputBorder:      "var(--input-border)",
    inputFocus:       "var(--input-focus)",

    ring:             "var(--ring)",

    textPrimary:      "var(--text-primary)",
    textSecondary:    "var(--text-secondary)",
    textMuted:        "var(--text-muted)",
    textDisabled:     "var(--text-disabled)",

    success:          "var(--success)",
    successMuted:     "var(--success-muted)",
    warning:          "var(--warning)",
    warningMuted:     "var(--warning-muted)",
    danger:           "var(--danger)",
    dangerMuted:      "var(--danger-muted)",
    info:             "var(--info)",
    infoMuted:        "var(--info-muted)",

    sidebar:          "var(--sidebar)",
    sidebarForeground:"var(--sidebar-foreground)",
  },

  /** Raw hex values for chart libraries that don't support CSS vars */
  rawColors: {
    primary:    "#001F3F",
    accent:     "#14B8A6",
    success:    "#22C55E",
    warning:    "#F59E0B",
    danger:     "#EF4444",
    info:       "#3B82F6",
    slate400:   "#94A3B8",
    slate600:   "#475569",
    slate800:   "#1E293B",
  },

  /** Chart color palette (ordered for multi-series) */
  chartPalette: [
    "#14B8A6", // teal
    "#3B82F6", // blue
    "#F59E0B", // amber
    "#EF4444", // red
    "#8B5CF6", // violet
    "#EC4899", // pink
    "#22C55E", // green
    "#F97316", // orange
  ],

  radius: {
    sm:  "var(--radius-sm)",
    md:  "var(--radius-md)",
    lg:  "var(--radius-lg)",
    xl:  "var(--radius-xl)",
    "2xl": "var(--radius-2xl)",
  },

  shadows: {
    sm: "var(--shadow-sm)",
    md: "var(--shadow-md)",
    lg: "var(--shadow-lg)",
    xl: "var(--shadow-xl)",
  },
} as const;

export type Theme = typeof theme;
