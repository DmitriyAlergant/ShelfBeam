import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import { useHistoryStore } from "../../lib/stores/useHistoryStore";
import EmojiReactions from "../../components/EmojiReactions";
import { STATUS_OPTIONS } from "../../lib/reading-status";

export default function BookDetailScreen() {
  const { entryId, bookId } = useLocalSearchParams<{
    entryId: string;
    bookId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();

  const storeEntry = useHistoryStore((s) => s.entries.find((e) => e.entry.id === entryId));
  const storeUpdateEntry = useHistoryStore((s) => s.updateEntry);
  const storeRemoveEntry = useHistoryStore((s) => s.removeEntry);
  const storeFetchHistory = useHistoryStore((s) => s.fetchHistory);

  const book = storeEntry?.book ?? null;
  const [loading, setLoading] = useState(!storeEntry);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<string[]>(storeEntry?.entry.reactions || []);
  const [status, setStatus] = useState<string>(storeEntry?.entry.status || "reading");
  const [comment, setComment] = useState<string>(storeEntry?.entry.comment || "");

  // Fallback: if entry not in store (deep link), fetch history once
  useEffect(() => {
    if (storeEntry) { setLoading(false); return; }
    if (!activeProfile) return;
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        await storeFetchHistory(token, activeProfile.id);
      } catch {
        setError("Couldn't load this book. Please go back and try again.");
      }
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync local state when store entry arrives (from fallback fetch)
  useEffect(() => {
    if (storeEntry) {
      setReactions(storeEntry.entry.reactions || []);
      setStatus(storeEntry.entry.status);
      setComment(storeEntry.entry.comment || "");
    }
  }, [storeEntry?.entry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReaction = useCallback(
    async (emoji: string) => {
      if (!activeProfile || !entryId) return;
      const token = await getToken();
      if (!token) return;

      const newReactions = reactions.includes(emoji)
        ? reactions.filter((r) => r !== emoji)
        : [...reactions, emoji];

      setReactions(newReactions);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }

      await storeUpdateEntry(token, activeProfile.id, entryId, { reactions: newReactions });
    },
    [activeProfile, entryId, getToken, reactions, storeUpdateEntry]
  );

  const toggleStatus = useCallback(
    async (newStatus: string) => {
      if (!activeProfile || !entryId || newStatus === status) return;
      const token = await getToken();
      if (!token) return;

      setStatus(newStatus);
      await storeUpdateEntry(token, activeProfile.id, entryId, { status: newStatus });
    },
    [activeProfile, entryId, getToken, status, storeUpdateEntry]
  );

  const saveComment = useCallback(
    async (text: string) => {
      if (!activeProfile || !entryId) return;
      const token = await getToken();
      if (!token) return;

      await storeUpdateEntry(token, activeProfile.id, entryId, { comment: text || "" });
    },
    [activeProfile, entryId, getToken, storeUpdateEntry]
  );

  const handleDelete = useCallback(async () => {
    if (Platform.OS === "web") {
      if (!window.confirm("Remove from history?\nThis book will be removed from your reading history.")) return;
    } else {
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Remove from history?",
          "This book will be removed from your reading history.",
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Remove", style: "destructive", onPress: () => resolve(true) },
          ]
        );
      });
      if (!confirmed) return;
    }

    if (!activeProfile || !entryId) return;
    const token = await getToken();
    if (!token) return;
    await storeRemoveEntry(token, activeProfile.id, entryId);
    router.back();
  }, [activeProfile, entryId, getToken, router, storeRemoveEntry]);

  if (loading || !book) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={{ marginTop: spacing.lg, padding: spacing.md }} onPress={() => router.back()}>
              <Text style={styles.backText}>← Go Back</Text>
            </TouchableOpacity>
          </>
        ) : (
          <ActivityIndicator size="large" color={colors.beamYellow} />
        )}
      </View>
    );
  }

  const description =
    book.rawMetadata &&
    typeof book.rawMetadata === "object" &&
    "description" in (book.rawMetadata as Record<string, unknown>)
      ? String((book.rawMetadata as Record<string, unknown>).description)
      : null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Book cover area */}
      <View style={styles.coverSection}>
        <View style={styles.coverPlaceholder}>
          <Text style={styles.coverEmoji}>📕</Text>
        </View>
      </View>

      {/* Title & Author */}
      <View style={styles.infoSection}>
        <Text style={styles.title}>{book.title}</Text>
        {book.isSeries && (
          <View style={styles.seriesBadge}>
            <Text style={styles.seriesBadgeText}>Series</Text>
          </View>
        )}
        {book.author && <Text style={styles.author}>{book.author}</Text>}
      </View>

      {/* Reading status toggle */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reading Status</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.statusOption,
                status === opt.key && styles.statusOptionActive,
              ]}
              onPress={() => toggleStatus(opt.key)}
            >
              <Text style={styles.statusEmoji}>{opt.emoji}</Text>
              <Text
                style={[
                  styles.statusLabel,
                  status === opt.key && styles.statusLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reactions — Slack-style add/remove */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How did you feel about it?</Text>
        <EmojiReactions reactions={reactions} onToggle={toggleReaction} />
      </View>

      {/* Comment */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your comment</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          onChangeText={setComment}
          onBlur={() => saveComment(comment)}
          placeholder="What did you think about this book?"
          placeholderTextColor={colors.inkLight}
          multiline
        />
      </View>

      {/* Description */}
      {description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this book</Text>
          <Text style={styles.description}>{description}</Text>
        </View>
      )}

      {/* Remove button */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.removeButton} onPress={handleDelete}>
          <Text style={styles.removeText}>Remove from history</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bgCream,
    justifyContent: "center",
    alignItems: "center",
  },
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bgCream,
  },
  backButton: {
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.shelfBrown,
  },
  coverSection: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  coverPlaceholder: {
    width: 120,
    height: 170,
    borderRadius: radius.lg,
    backgroundColor: colors.beamYellowLight,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.card,
  },
  coverEmoji: {
    fontSize: 56,
  },
  infoSection: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
  },
  author: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: spacing.xs,
  },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: fonts.badge,
    color: colors.inkMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statusOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  statusOptionActive: {
    borderColor: colors.beamYellow,
    backgroundColor: colors.beamYellowLight,
  },
  statusEmoji: {
    fontSize: 18,
  },
  statusLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  statusLabelActive: {
    color: colors.inkDark,
  },
  seriesBadge: {
    backgroundColor: colors.tealLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  seriesBadgeText: {
    fontSize: 12,
    fontFamily: fonts.badge,
    color: colors.pageTeal,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  commentInput: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: 60,
    textAlignVertical: "top",
  },
  description: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    lineHeight: 22,
  },
  removeButton: {
    alignItems: "center",
    paddingVertical: spacing.md,
    marginTop: spacing.md,
  },
  removeText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.spineCoral,
  },
  errorMessage: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    paddingHorizontal: spacing.xl,
  },
});
