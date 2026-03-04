import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
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
  getBook,
  updateHistoryEntry,
  deleteHistoryEntry,
  type BookData,
  type HistoryEntry,
  getHistory,
} from "../../lib/api";

const REACTION_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "😂", "😢", "😱", "🤔", "🤯", "💤", "😡",
];

const STATUS_OPTIONS = [
  { key: "reading", label: "Currently Reading", emoji: "📖" },
  { key: "finished", label: "Finished", emoji: "✅" },
];

export default function BookDetailScreen() {
  const { entryId, bookId } = useLocalSearchParams<{
    entryId: string;
    bookId: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();

  const [book, setBook] = useState<BookData | null>(null);
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [reactions, setReactions] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("reading");

  useEffect(() => {
    (async () => {
      if (!bookId || !activeProfile) return;
      const token = await getToken();
      if (!token) return;

      try {
        const bookData = await getBook(token, bookId);
        setBook(bookData);

        // Find the history entry
        const history = await getHistory(token, activeProfile.id);
        const all = [...history.reading, ...history.finished];
        const found = all.find((h) => h.entry.id === entryId);
        if (found) {
          setEntry(found.entry);
          setReactions(found.entry.reactions || []);
          setStatus(found.entry.status);
        }
      } catch (err) {
        console.error("Failed to load book detail:", err);
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, entryId, activeProfile?.id]);

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

      const updated = await updateHistoryEntry(
        token,
        activeProfile.id,
        entryId,
        { reactions: newReactions }
      );
      setEntry(updated);
    },
    [activeProfile, entryId, getToken, reactions]
  );

  const toggleStatus = useCallback(
    async (newStatus: string) => {
      if (!activeProfile || !entryId || newStatus === status) return;
      const token = await getToken();
      if (!token) return;

      setStatus(newStatus);
      const updated = await updateHistoryEntry(
        token,
        activeProfile.id,
        entryId,
        { status: newStatus }
      );
      setEntry(updated);
    },
    [activeProfile, entryId, getToken, status]
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
    await deleteHistoryEntry(token, activeProfile.id, entryId);
    router.back();
  }, [activeProfile, entryId, getToken, router]);

  if (loading || !book) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.beamYellow} />
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

      {/* Reactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How did you feel about it?</Text>
        <View style={styles.reactionGrid}>
          {REACTION_EMOJIS.map((emoji) => {
            const isSelected = reactions.includes(emoji);
            return (
              <TouchableOpacity
                key={emoji}
                style={[
                  styles.reactionPill,
                  isSelected && styles.reactionPillSelected,
                ]}
                onPress={() => toggleReaction(emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
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
  reactionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  reactionPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
  },
  reactionPillSelected: {
    backgroundColor: colors.coralLight,
    borderWidth: 2,
    borderColor: colors.spineCoral,
  },
  reactionEmoji: {
    fontSize: 22,
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
});
