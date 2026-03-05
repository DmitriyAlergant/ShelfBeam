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
import { Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import {
  createBook,
  addToHistory,
  updateHistoryEntry,
  type ParsedBookEntry,
} from "../../lib/api";
import EmojiReactions from "../../components/EmojiReactions";
import { STATUS_OPTIONS } from "../../lib/reading-status";

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

  const parsedEntries: ParsedBookEntry[] = (() => {
    try {
      return parsed ? JSON.parse(parsed) : [];
    } catch {
      return [];
    }
  })();

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

    try {
      const activeEntries = entries.filter((e) => !e.removed);

      for (const entry of activeEntries) {
        if (entry.entry_type === "update" && entry.existing_history_entry_id) {
          // Update existing history entry
          await updateHistoryEntry(token, activeProfile.id, entry.existing_history_entry_id, {
            status: entry.status,
            reactions: entry.reactions,
            comment: entry.comment || undefined,
          });
        } else {
          // New book: create book then add to history
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
      }

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      // Navigate back to books tab
      router.dismissAll();
      router.replace("/(main)/(tabs)/books");
    } catch (err) {
      Alert.alert("Error", "Failed to save reading log. Please try again.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const activeEntries = entries.filter((e) => !e.removed);
  const newEntries = entries.filter((e) => e.entry_type !== "update");
  const updateEntries = entries.filter((e) => e.entry_type === "update");
  const activeCount = activeEntries.length;
  const activeNewCount = newEntries.filter((e) => !e.removed).length;
  const activeUpdateCount = updateEntries.filter((e) => !e.removed).length;

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

        {/* New books section */}
        {newEntries.length > 0 && (
          <>
            {updateEntries.length > 0 && (
              <Text style={styles.sectionHeader}>New Books</Text>
            )}
            {newEntries.map((entry) => {
              const idx = entries.indexOf(entry);
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

                  {/* Status + Reactions row */}
                  <View style={styles.statusReactionRow}>
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
                    <View style={styles.reactionDivider} />
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
          </>
        )}

        {/* Updates section */}
        {updateEntries.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Updates to Your History</Text>
            {updateEntries.map((entry) => {
              const idx = entries.indexOf(entry);
              // Build compact change summary
              const changes: string[] = [];
              if (entry.inferred_status) {
                const statusLabel = STATUS_OPTIONS.find((o) => o.key === entry.status);
                changes.push(statusLabel ? statusLabel.label.toLowerCase() : entry.status);
              }
              if (entry.reactions.length > 0) changes.push(entry.reactions.join(""));
              if (entry.comment) changes.push(`"${entry.comment}"`);
              const summary = changes.length > 0 ? changes.join(" · ") : "minor update";

              if (entry.removed) {
                return (
                  <View key={idx} style={styles.removedCard}>
                    <Text style={styles.removedText}>
                      {entry.title} — skipped
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
                <View key={idx} style={styles.updateRow}>
                  <View style={styles.updateContent}>
                    <Text style={styles.updateTitle} numberOfLines={1}>
                      {entry.title}
                      {entry.author ? (
                        <Text style={styles.updateAuthor}> by {entry.author}</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.updateSummary} numberOfLines={2}>
                      {summary}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => updateEntry(idx, { removed: true })}
                  >
                    <Text style={styles.removeIcon}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}

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
              {activeUpdateCount > 0 && activeNewCount > 0
                ? `Add ${activeNewCount} new, update ${activeUpdateCount}`
                : activeUpdateCount > 0
                  ? `Update ${activeUpdateCount} book${activeUpdateCount !== 1 ? "s" : ""}`
                  : `Add ${activeNewCount} book${activeNewCount !== 1 ? "s" : ""}`}
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
    paddingHorizontal: spacing.md,
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
  sectionHeader: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.inkMedium,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  entryCard: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  updateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.pageTeal,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  updateContent: {
    flex: 1,
  },
  updateTitle: {
    fontSize: 15,
    fontFamily: fonts.headingMedium,
    color: colors.inkDark,
  },
  updateAuthor: {
    fontFamily: fonts.body,
    color: colors.inkMedium,
  },
  updateSummary: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: 2,
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
  statusReactionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: colors.bgCream,
  },
  statusChipActive: {
    backgroundColor: colors.beamYellow,
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  statusChipTextActive: {
    color: colors.inkDark,
  },
  reactionDivider: {
    width: 1,
    height: 20,
    backgroundColor: colors.inkLight,
    opacity: 0.3,
    marginHorizontal: 2,
  },
  commentInput: {
    marginTop: spacing.sm,
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
