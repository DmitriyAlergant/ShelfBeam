import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";

export default function ScanHome() {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Scan a Shelf</Text>

      <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
        <Text style={styles.ctaEmoji}>📷</Text>
        <Text style={styles.ctaText}>Scan a Bookshelf</Text>
      </TouchableOpacity>

      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📖</Text>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptySubtitle}>
          Take a photo of a bookshelf to discover great reads!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  header: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.lg,
  },
  ctaButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    ...shadows.button,
  },
  ctaEmoji: {
    fontSize: 28,
  },
  ctaText: {
    color: colors.inkDark,
    fontSize: 20,
    fontFamily: fonts.heading,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});
