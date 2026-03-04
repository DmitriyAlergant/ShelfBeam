import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { parseReadingLog } from "../../lib/api";

export default function ReadingLogEntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    const token = await getToken();
    if (!token) {
      setSubmitting(false);
      return;
    }

    const parsed = await parseReadingLog(token, text.trim());
    setSubmitting(false);

    router.push({
      pathname: "/(main)/reading-log-confirmation",
      params: { parsed: JSON.stringify(parsed), rawText: text.trim() },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <Text style={styles.header}>Tell us what you've read</Text>
        <Text style={styles.subtitle}>
          Type or dictate what you've been reading. We'll figure out the rest!
        </Text>

        <TextInput
          style={styles.textArea}
          value={text}
          onChangeText={setText}
          placeholder="I read Harry Potter and loved the magic parts but it was a little scary. I also finished Diary of a Wimpy Kid, that one was really funny..."
          placeholderTextColor={colors.inkLight}
          multiline
          textAlignVertical="top"
          textContentType="none"
          autoFocus
        />

        <Text style={styles.hint}>
          🎤 Tip: Tap the microphone on your keyboard to dictate!
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            !text.trim() && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!text.trim() || submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={colors.inkDark} />
          ) : (
            <Text style={styles.submitText}>See what we found</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backButton: {
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.shelfBrown,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  textArea: {
    flex: 1,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    padding: spacing.lg,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkDark,
    lineHeight: 24,
    minHeight: 200,
    ...shadows.card,
  },
  hint: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  submitButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.button,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 17,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
});
