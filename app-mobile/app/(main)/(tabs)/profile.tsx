import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { DiceBearAvatar } from "../../../components/DiceBearAvatar";

export default function ProfileScreen() {
  const { activeProfile } = useAppContext();

  if (!activeProfile) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Reader Profile</Text>

      <View style={styles.profileCard}>
        <DiceBearAvatar
          seed={activeProfile.avatarKey || activeProfile.name}
          size={80}
          active
        />
        <Text style={styles.name}>{activeProfile.name}</Text>

        {activeProfile.interests && activeProfile.interests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.chips}>
              {activeProfile.interests.map((tag) => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {activeProfile.birthYear && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Birth Year</Text>
            <Text style={styles.sectionValue}>{activeProfile.birthYear}</Text>
          </View>
        )}
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
  profileCard: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadows.card,
  },
  name: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  section: {
    width: "100%",
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: fonts.badge,
    color: colors.inkMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  sectionValue: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.beamYellowLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: colors.shelfBrown,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
  },
});
