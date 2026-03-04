import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { getHistory, type HistoryWithBook } from "../../../lib/api";

const SOURCE_LABELS: Record<string, string> = {
  scan: "From scan",
  reading_log: "Logged by you",
};

export default function MyBooks() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { activeProfile } = useAppContext();
  const [reading, setReading] = useState<HistoryWithBook[]>([]);
  const [finished, setFinished] = useState<HistoryWithBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;
    const data = await getHistory(token, activeProfile.id);
    setReading(data.reading);
    setFinished(data.finished);
  }, [activeProfile, getToken]);

  useEffect(() => {
    fetchHistory().finally(() => setLoading(false));
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const renderBookCard = useCallback(
    ({ item }: { item: HistoryWithBook }) => {
      const { entry, book } = item;
      if (!book) return null;
      return (
        <TouchableOpacity
          style={styles.bookCard}
          activeOpacity={0.8}
          onPress={() =>
            router.push(
              `/(main)/book-detail?entryId=${entry.id}&bookId=${book.id}`
            )
          }
        >
          <View style={styles.bookCoverPlaceholder}>
            <Text style={styles.bookCoverEmoji}>📕</Text>
          </View>
          <View style={styles.bookInfo}>
            <Text style={styles.bookTitle} numberOfLines={2}>
              {book.title}
            </Text>
            {book.author && (
              <Text style={styles.bookAuthor} numberOfLines={1}>
                {book.author}
              </Text>
            )}
            <View style={styles.bookMeta}>
              <View style={styles.sourceBadge}>
                <Text style={styles.sourceText}>
                  {SOURCE_LABELS[entry.source] || entry.source}
                </Text>
              </View>
              {entry.reactions && entry.reactions.length > 0 && (
                <Text style={styles.reactions}>
                  {entry.reactions.join(" ")}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [router]
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.beamYellow} />
      </View>
    );
  }

  const hasBooks = reading.length > 0 || finished.length > 0;

  const sections = [
    ...(reading.length > 0
      ? [{ type: "header" as const, title: "Currently Reading" }]
      : []),
    ...reading.map((item) => ({ type: "book" as const, data: item })),
    ...(finished.length > 0
      ? [{ type: "header" as const, title: "Finished" }]
      : []),
    ...finished.map((item) => ({ type: "book" as const, data: item })),
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Books</Text>

      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push("/(main)/reading-log-entry")}
      >
        <Ionicons name="create-outline" size={22} color={colors.inkDark} />
        <Text style={styles.ctaText}>Tell us what you've read</Text>
      </TouchableOpacity>

      {!hasBooks ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet</Text>
          <Text style={styles.emptySubtitle}>
            Scan a shelf to discover books, or tell us what you've been reading!
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item, idx) =>
            item.type === "header" ? `h-${item.title}` : `b-${item.data.entry.id}`
          }
          renderItem={({ item }) => {
            if (item.type === "header") {
              return (
                <Text style={styles.sectionHeader}>{item.title}</Text>
              );
            }
            return renderBookCard({ item: item.data });
          }}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.beamYellow}
            />
          }
        />
      )}
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
  centerContainer: {
    flex: 1,
    backgroundColor: colors.bgCream,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.xl,
  },
  ctaButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    ...shadows.button,
    marginBottom: spacing.lg,
  },
  ctaText: {
    color: colors.inkDark,
    fontSize: 17,
    fontFamily: fonts.heading,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  bookCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  bookCoverPlaceholder: {
    width: 48,
    height: 64,
    borderRadius: radius.sm,
    backgroundColor: colors.beamYellowLight,
    justifyContent: "center",
    alignItems: "center",
  },
  bookCoverEmoji: {
    fontSize: 24,
  },
  bookInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  bookTitle: {
    fontSize: 15,
    fontFamily: fonts.contentHeadingMedium,
    color: colors.inkDark,
  },
  bookAuthor: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: 2,
  },
  bookMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sourceBadge: {
    backgroundColor: colors.tealLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 11,
    fontFamily: fonts.badge,
    color: colors.pageTeal,
  },
  reactions: {
    fontSize: 14,
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
