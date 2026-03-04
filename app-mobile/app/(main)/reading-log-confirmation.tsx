import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import {
  createBook,
  addToHistory,
  type ParsedBookEntry,
} from "../../lib/api";

const STATUS_OPTIONS = [
  { key: "reading", label: "Reading" },
  { key: "finished", label: "Finished" },
];

const REACTION_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "😂", "😢", "😱", "🤔", "🤯", "💤", "😡",
];

type EditableEntry = ParsedBookEntry & {
  removed: boolean;
  reactions: string[];
  status: string;
};

export default function ReadingLogConfirmationScreen() {
  const { parsed } = useLocalSearchParams<{ parsed: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { activeProfile } = useAppContext();
  const [saving, setSaving] = useState(false);

  const parsedEntries: ParsedBookEntry[] = parsed ? JSON.parse(parsed) : [];

  const [entries, setEntries] = useState<EditableEntry[]>(
    parsedEntries.map((e) => ({
      ...e,
      removed: false,
      reactions: e.inferred_reactions || [],
      status: e.inferred_status || "reading",
    }))
  );

  const updateEntry = useCallback(
    (index: number, updates: Partial<EditableEntry>) => {
      setEntries((prev) =>
        prev.map((e, i) => (i === index ? { ...e, ...updates } : e))
      );
    },
    []
  );

  const toggleReaction = useCallback(
    (index: number, emoji: string) => {
      setEntries((prev) =>
        prev.map((e, i) => {
          if (i !== index) return e;
          const newReactions = e.reactions.includes(emoji)
            ? e.reactions.filter((r) => r !== emoji)
            : [...e.reactions, emoji];
          return { ...e, reactions: newReactions };
        })
      );
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    []
  );

  const handleConfirm = async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;

    setSaving(true);

    const activeEntries = entries.filter((e) => !e.removed);

    for (const entry of activeEntries) {
      const book = await createBook(token, {
        title: entry.title,
        author: entry.author,
      });

      await addToHistory(token, activeProfile.id, {
        book_id: book.id,
        source: "reading_log",
        status: entry.status,
      });

      // Update reactions if any
      // Note: reactions are set after history entry creation via the entry itself
    }

    setSaving(false);
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Navigate back to books tab
    router.dismissAll();
    router.replace("/(main)/(tabs)/books");
  };

  const activeCount = entries.filter((e) => !e.removed).length;

  return (
    <View style={styles.container}>
      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={28} color={colors.shelfBrown} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.header}>Here's what we found</Text>
        <Text style={styles.subtitle}>
          Review and edit before adding to your history.
        </Text>

        {entries.map((entry, idx) => {
          if (entry.removed) {
            return (
              <View key={idx} style={styles.removedCard}>
                <Text style={styles.removedText}>
                  {entry.title} — removed
                </Text>
                <TouchableOpacity
                  onPress={() => updateEntry(idx, { removed: false })}
                >
                  <Text style={styles.undoText}>Undo</Text>
                </TouchableOpacity>
              </View>
            );
          }

          return (
            <View key={idx} style={styles.entryCard}>
              <View style={styles.entryHeader}>
                <View style={styles.entryTitleRow}>
                  <Text style={styles.entryEmoji}>📕</Text>
                  <View style={styles.entryTitleWrap}>
                    <TextInput
                      style={styles.entryTitle}
                      value={entry.title}
                      onChangeText={(t) => updateEntry(idx, { title: t })}
                      placeholder="Book title"
                      placeholderTextColor={colors.inkLight}
                    />
                    <TextInput
                      style={styles.entryAuthor}
                      value={entry.author || ""}
                      onChangeText={(a) => updateEntry(idx, { author: a })}
                      placeholder="Author (optional)"
                      placeholderTextColor={colors.inkLight}
                    />
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => updateEntry(idx, { removed: true })}
                >
                  <Text style={styles.removeIcon}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Status selector */}
              <View style={styles.statusRow}>
                {STATUS_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.statusChip,
                      entry.status === opt.key && styles.statusChipActive,
                    ]}
                    onPress={() => updateEntry(idx, { status: opt.key })}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        entry.status === opt.key && styles.statusChipTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Reaction chips */}
              <View style={styles.reactionRow}>
                {REACTION_EMOJIS.map((emoji) => {
                  const isSelected = entry.reactions.includes(emoji);
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.reactionChip,
                        isSelected && styles.reactionChipSelected,
                      ]}
                      onPress={() => toggleReaction(idx, emoji)}
                    >
                      <Text style={styles.reactionChipEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        {entries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🤔</Text>
            <Text style={styles.emptyText}>
              We couldn't find any books. Try describing them differently!
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}
      >
        <TouchableOpacity
          style={[
            styles.confirmButton,
            activeCount === 0 && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={activeCount === 0 || saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color={colors.inkDark} />
          ) : (
            <Text style={styles.confirmText}>
              Looks good! Add {activeCount} book{activeCount !== 1 ? "s" : ""}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    width: 44,
    height: 44,
    justifyContent: "center",
  },
  scrollView: {
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
    marginBottom: spacing.lg,
  },
  entryCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  entryTitleRow: {
    flexDirection: "row",
    flex: 1,
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  entryEmoji: {
    fontSize: 28,
    marginTop: 2,
  },
  entryTitleWrap: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 17,
    fontFamily: fonts.contentHeadingMedium,
    color: colors.inkDark,
    padding: 0,
  },
  entryAuthor: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    padding: 0,
    marginTop: 2,
  },
  removeIcon: {
    fontSize: 18,
    color: colors.inkLight,
    padding: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCream,
  },
  statusChipActive: {
    backgroundColor: colors.beamYellow,
  },
  statusChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  statusChipTextActive: {
    color: colors.inkDark,
  },
  reactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  reactionChip: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.bgCream,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionChipSelected: {
    backgroundColor: colors.coralLight,
    borderWidth: 2,
    borderColor: colors.spineCoral,
  },
  reactionChipEmoji: {
    fontSize: 16,
  },
  removedCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    opacity: 0.6,
  },
  removedText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkLight,
    textDecorationLine: "line-through",
  },
  undoText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.pageTeal,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bgCream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  confirmButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.button,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmText: {
    fontSize: 17,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
});
