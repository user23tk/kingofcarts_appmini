export type ThemeName = "fantasy" | "sci-fi" | "mystery" | "horror" | "romance" | "adventure" | "comedy"

export interface ThemeColors {
  primary: string
  light: string
  gradient: [string, string]
  textShadow: string
}

export const THEME_COLORS: Record<ThemeName, ThemeColors> = {
  fantasy: {
    primary: "#9333EA",
    light: "#C084FC",
    gradient: ["#9333EA", "#C084FC"],
    textShadow: "0 2px 10px rgba(147, 51, 234, 0.5)",
  },
  "sci-fi": {
    primary: "#06B6D4",
    light: "#22D3EE",
    gradient: ["#06B6D4", "#22D3EE"],
    textShadow: "0 2px 10px rgba(6, 182, 212, 0.5)",
  },
  mystery: {
    primary: "#DC2626",
    light: "#F87171",
    gradient: ["#DC2626", "#F87171"],
    textShadow: "0 2px 10px rgba(220, 38, 38, 0.5)",
  },
  horror: {
    primary: "#7C3AED",
    light: "#A78BFA",
    gradient: ["#7C3AED", "#A78BFA"],
    textShadow: "0 2px 10px rgba(124, 58, 237, 0.5)",
  },
  romance: {
    primary: "#EC4899",
    light: "#F9A8D4",
    gradient: ["#EC4899", "#F9A8D4"],
    textShadow: "0 2px 10px rgba(236, 72, 153, 0.5)",
  },
  adventure: {
    primary: "#F59E0B",
    light: "#FCD34D",
    gradient: ["#F59E0B", "#FCD34D"],
    textShadow: "0 2px 10px rgba(245, 158, 11, 0.5)",
  },
  comedy: {
    primary: "#10B981",
    light: "#6EE7B7",
    gradient: ["#10B981", "#6EE7B7"],
    textShadow: "0 2px 10px rgba(16, 185, 129, 0.5)",
  },
}

export function getThemeColors(theme: string): ThemeColors {
  const normalizedTheme = theme.toLowerCase() as ThemeName
  return THEME_COLORS[normalizedTheme] || THEME_COLORS.fantasy
}

export function getThemeGradient(theme: string): string {
  const colors = getThemeColors(theme)
  return `linear-gradient(135deg, ${colors.gradient[0]}, ${colors.gradient[1]})`
}
