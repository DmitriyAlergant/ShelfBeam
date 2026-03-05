import { StyleSheet } from "react-native";
import { colors, fonts, radius, spacing } from "./theme";

export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 40,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.coralLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.spineCoral,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },
  ssoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  ssoButtonDark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkDark,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  ssoButtonText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.inkDark,
  },
  ssoButtonTextLight: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: "#fff",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inkLight,
    opacity: 0.4,
  },
  dividerText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkLight,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  linkLabel: {
    color: colors.inkMedium,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  link: {
    color: colors.shelfBrown,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
});
