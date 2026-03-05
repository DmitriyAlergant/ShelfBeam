import { useRouter } from "expo-router";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";

const heroImage = require("../../assets/hero.jpeg");
const framingTipImage = require("../../assets/framing-tip-v2.png");

const STEPS = [
  {
    number: "1",
    title: "Create a Reader Profile",
    description: "Share a few details about your young reader — age, interests, and what they love.",
  },
  {
    number: "2",
    title: "Add Reading History",
    description: "Tell us about books you've read and how you felt about them. We learn your taste.",
  },
  {
    number: "3",
    title: "Scan a Library Shelf",
    description: "Snap a photo of any bookshelf and get personalized picks in seconds.",
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { setHasSeenWelcome } = useAppContext();

  const handleGetStarted = () => {
    setHasSeenWelcome(true);
    router.replace("/(main)/profile-picker");
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.heroWrap}>
          <Image source={heroImage} style={styles.heroImage} />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>ShelfBeam</Text>
            <Text style={styles.heroTagline}>Snap a shelf. Find your next read.</Text>
          </View>
        </View>

        {/* 1-2-3 Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          {STEPS.map((step) => (
            <View key={step.number} style={styles.stepRow}>
              <View style={styles.stepCircle}>
                <Text style={styles.stepNumber}>{step.number}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Framing Tip */}
        <View style={styles.tipCard}>
          <Image source={framingTipImage} style={styles.tipImage} resizeMode="cover" />
          <View style={styles.tipTextWrap}>
            <Text style={styles.tipLabel}>Pro Tip</Text>
            <Text style={styles.tipText}>
              Hold phone in landscape, frame exactly two shelves for the best results.
            </Text>
          </View>
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleGetStarted} activeOpacity={0.85}>
          <Text style={styles.ctaText}>Get Started</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  scroll: {
    paddingBottom: spacing.md,
  },
  // Hero
  heroWrap: {
    height: 160,
    position: "relative",
    overflow: "hidden",
  },
  heroImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(45,35,25,0.45)",
  },
  heroContent: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  heroTitle: {
    fontSize: 36,
    fontFamily: fonts.heading,
    color: colors.bgCream,
    textShadowColor: "rgba(45,35,25,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroTagline: {
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    color: colors.bgCream,
    marginTop: 2,
    textShadowColor: "rgba(45,35,25,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  // Pitch
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  pitch: {
    fontSize: 17,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    lineHeight: 26,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  // Steps
  stepRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  stepCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.beamYellow,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.button,
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    color: colors.inkDark,
    marginBottom: 2,
  },
  stepDesc: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    lineHeight: 19,
  },
  // Framing Tip
  tipCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    overflow: "hidden",
    flexDirection: "row",
    ...shadows.card,
  },
  tipImage: {
    width: 170,
    height: 100,
  },
  tipTextWrap: {
    flex: 1,
    padding: spacing.sm,
    justifyContent: "center",
  },
  tipLabel: {
    fontSize: 10,
    fontFamily: fonts.badge,
    color: colors.shelfBrown,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 2,
  },
  tipText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    lineHeight: 17,
  },
  // CTA
  ctaButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: "center",
    ...shadows.button,
  },
  ctaText: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});
