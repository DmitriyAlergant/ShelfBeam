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
import { useAppAuth } from "../../lib/auth";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import {
  createBook,
  addToHistory,
  type ParsedBookEntry,
} from "../../lib/api";
import EmojiReactions from "../../components/EmojiReactions";

const STATUS_OPTIONS = [
  { key: "reading", label: "Reading" },
  { key: "finished", label: "Finished" },
];

type EditableEntry = ParsedBookEntry & {
  removed: boolean;
  reactions: string[];
  status: string;
  comment: string;
};

export default function ReadingLogConfirmationScreen() {
  const { parsed } = useLocalSearchParams<{ parsed: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();
  const [saving, setSaving] = useState(false);

  const parsedEntries: ParsedBookEntry[] = parsed ? JSON.parse(parsed) : [];

  const [entries, setEntries] = useState<EditableEntry[]>(
    parsedEntries.map((e) => ({
      ...e,
      removed: false,
      reactions: e.inferred_reactions || [],
      status: e.inferred_status || "reading",
      comment: e.comment || "",
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
        is_series: entry.is_series ?? false,
      });

      await addToHistory(token, activeProfile.id, {
        book_id: book.id,
        source: "reading_log",
        status: entry.status,
        reactions: entry.reactions,
        comment: entry.comment || undefined,
      });
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
          <Text style={styles.backText}>← Back</Text>
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

              {/* Reaction chips — Slack-style */}
              <View style={styles.reactionWrapper}>
                <EmojiReactions
                  reactions={entry.reactions}
                  onToggle={(emoji) => toggleReaction(idx, emoji)}
                  compact
                />
              </View>

              {/* Comment */}
              <TextInput
                style={styles.commentInput}
                value={entry.comment}
                onChangeText={(c) => updateEntry(idx, { comment: c })}
                placeholder="Add a comment..."
                placeholderTextColor={colors.inkLight}
                multiline
              />
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
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.shelfBrown,
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
    backgroundColor: colors.bgWarm,
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
    fontFamily: fonts.headingMedium,
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
    borderRadius: radius.md,
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
  reactionWrapper: {
    marginTop: spacing.md,
  },
  commentInput: {
    marginTop: spacing.md,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkDark,
    backgroundColor: colors.bgCream,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 36,
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
    borderTopWidth: 1,
    borderTopColor: colors.bgWarm,
  },
  confirmButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.lg,
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
