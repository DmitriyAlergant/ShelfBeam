/**
 * BookBeam Design System — "Magic Library" theme
 * Warm maximalism with paper texture. Wes Anderson meets a children's museum.
 */

export const colors = {
  bgCream: "#FFF8F0",
  bgWarm: "#F5EDE3",
  bgSurface: "#F9F2EA",
  shelfBrown: "#8B6914",
  beamYellow: "#FFD234",
  pageTeal: "#2EC4B6",
  spineCoral: "#FF6B6B",
  inkDark: "#2D2319",
  inkMedium: "#7A6B5D",
  inkLight: "#B8A99A",
  shadow: "rgba(45,35,25,0.08)",
  border: "rgba(139,105,20,0.10)",
  // Derived
  beamYellowLight: "rgba(255,210,52,0.15)",
  coralLight: "rgba(255,107,107,0.12)",
  tealLight: "rgba(46,196,182,0.12)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 100,
} as const;

export const fonts = {
  // Display / Headers (UI chrome — always English)
  heading: "Fredoka_700Bold",
  headingMedium: "Fredoka_500Medium",
  headingSemiBold: "Fredoka_600SemiBold",
  // Content headers (book titles, user content — may be non-Latin)
  contentHeading: "Nunito_700Bold",
  contentHeadingMedium: "Nunito_600SemiBold",
  // Body / UI
  body: "Nunito_400Regular",
  bodyMedium: "Nunito_600SemiBold",
  bodyBold: "Nunito_700Bold",
  // Accent / Badges
  badge: "Fredoka_600SemiBold",
} as const;

export const shadows = {
  subtle: {
    shadowColor: colors.inkDark,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: colors.inkDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  button: {
    shadowColor: colors.beamYellow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  tabBar: {
    shadowColor: colors.inkDark,
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
} as const;
