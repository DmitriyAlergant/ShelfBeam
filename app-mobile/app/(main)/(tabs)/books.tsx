import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useRouter } from "expo-router";
import { useAppAuth } from "../../../lib/auth";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { type HistoryWithBook } from "../../../lib/api";
import { useHistoryStore } from "../../../lib/stores/useHistoryStore";
import { STATUS_LABELS } from "../../../lib/reading-status";
import SwipeToDelete from "../../../components/SwipeToDelete";
import ConfirmModal from "../../../components/ConfirmModal";

const SOURCE_LABELS: Record<string, string> = {
  scan: "Picked from scanned shelf",
};

export default function MyBooks() {
  const router = useRouter();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();
  const entries = useHistoryStore((s) => s.entries);
  const loading = useHistoryStore((s) => s.loading);
  const storeFetchHistory = useHistoryStore((s) => s.fetchHistory);
  const storeRemoveEntry = useHistoryStore((s) => s.removeEntry);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const fetchHistory = useCallback(async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;
    await storeFetchHistory(token, activeProfile.id);
  }, [activeProfile, getToken, storeFetchHistory]);

  useEffect(() => {
    useHistoryStore.getState().reset();
    fetchHistory();
  }, [fetchHistory]);

  // Re-fetch when screen regains focus (e.g. returning from book-detail)
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        fetchHistory();
      }
    }, [fetchHistory, loading])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const handleDeleteCancel = useCallback(() => {
    if (deletingEntryId) {
      swipeableRefs.current.get(deletingEntryId)?.close();
    }
    setDeletingEntryId(null);
  }, [deletingEntryId]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingEntryId || !activeProfile) return;
    setDeleteLoading(true);
    const token = await getToken();
    if (!token) return;
    await storeRemoveEntry(token, activeProfile.id, deletingEntryId);
    setDeleteLoading(false);
    setDeletingEntryId(null);
  }, [deletingEntryId, activeProfile, getToken, storeRemoveEntry]);

  const renderBookCard = useCallback(
    ({ item }: { item: HistoryWithBook }) => {
      const { entry, book } = item;
      if (!book) return null;
      return (
        <SwipeToDelete
          ref={(ref) => {
            if (ref) swipeableRefs.current.set(entry.id, ref);
            else swipeableRefs.current.delete(entry.id);
          }}
          onDelete={() => setDeletingEntryId(entry.id)}
        >
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
              <View style={styles.titleRow}>
                <Text style={styles.bookTitle} numberOfLines={2}>
                  {book.title}
                </Text>
                {entry.reactions && entry.reactions.length > 0 && (
                  <Text style={styles.reactions}>
                    {entry.reactions.join(" ")}
                  </Text>
                )}
              </View>
              {book.author && (
                <Text style={styles.bookAuthor} numberOfLines={1}>
                  {book.author}
                </Text>
              )}
              <View style={styles.bookMeta}>
                <View style={[
                  styles.statusBadge,
                  entry.status === "reading" && styles.statusBadgeReading,
                  entry.status === "finished" && styles.statusBadgeFinished,
                  entry.status === "abandoned" && styles.statusBadgeAbandoned,
                ]}>
                  <Text style={styles.statusBadgeText}>
                    {STATUS_LABELS[entry.status] || entry.status}
                  </Text>
                </View>
                {book.isSeries && (
                  <View style={styles.seriesBadge}>
                    <Text style={styles.seriesText}>Series</Text>
                  </View>
                )}
                {SOURCE_LABELS[entry.source] && (
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceText}>
                      {SOURCE_LABELS[entry.source]}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </SwipeToDelete>
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Your Reading History</Text>

      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push("/(main)/reading-log-entry")}
      >
        <Text style={styles.ctaEmoji}>✏️</Text>
        <Text style={styles.ctaText}>Tell us what you read already</Text>
      </TouchableOpacity>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No books yet</Text>
          <Text style={styles.emptySubtitle}>
            Scan a shelf to discover books, or tell us what you&apos;ve been reading!
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.entry.id}
          renderItem={renderBookCard}
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

      <ConfirmModal
        visible={deletingEntryId !== null}
        title="Remove Book?"
        message="This will remove the book from your reading history."
        confirmLabel="Remove"
        destructive
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
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
    marginBottom: spacing.lg,
  },
  ctaButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.md,
    ...shadows.button,
    marginBottom: spacing.lg,
  },
  ctaEmoji: {
    fontSize: 22,
  },
  ctaText: {
    color: colors.inkDark,
    fontSize: 17,
    fontFamily: fonts.heading,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  bookCard: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.sm,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  bookCoverPlaceholder: {
    width: 40,
    height: 54,
    borderRadius: radius.sm,
    backgroundColor: colors.beamYellowLight,
    justifyContent: "center",
    alignItems: "center",
  },
  bookCoverEmoji: {
    fontSize: 20,
  },
  bookInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  bookTitle: {
    fontSize: 15,
    fontFamily: fonts.headingMedium,
    color: colors.inkDark,
    flex: 1,
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
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusBadgeReading: {
    backgroundColor: colors.beamYellowLight,
  },
  statusBadgeFinished: {
    backgroundColor: colors.tealLight,
  },
  statusBadgeAbandoned: {
    backgroundColor: "rgba(255,107,107,0.12)",
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: fonts.badge,
    color: colors.inkDark,
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
    fontSize: 18,
  },
  seriesBadge: {
    backgroundColor: colors.tealLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  seriesText: {
    fontSize: 11,
    fontFamily: fonts.badge,
    color: colors.pageTeal,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
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
