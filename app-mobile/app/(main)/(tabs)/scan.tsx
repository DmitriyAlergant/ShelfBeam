import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import SwipeToDelete from "../../../components/SwipeToDelete";
import ConfirmModal from "../../../components/ConfirmModal";
import { useRouter } from "expo-router";
import { useAppAuth } from "../../../lib/auth";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { getScans, deleteScan, getImageUrl, type ScanData } from "../../../lib/api";

const STATUS_LABELS: Record<string, string> = {
  pending: "In queue...",
  detecting: "Finding books...",
  reading: "Reading spines...",
  looking_up: "Learning...",
  recommending: "Picking favorites...",
  done: "Done",
  error: "Error",
  failed: "Error",
};

const STATUS_COLORS: Record<string, string> = {
  pending: colors.beamYellow,
  detecting: colors.beamYellow,
  reading: colors.beamYellow,
  looking_up: colors.pageTeal,
  recommending: colors.pageTeal,
  done: colors.pageTeal,
  error: colors.spineCoral,
  failed: colors.spineCoral,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function countBooks(scan: ScanData): number {
  if (!scan.detectedBooks || !Array.isArray(scan.detectedBooks)) return 0;
  return scan.detectedBooks.length;
}


export default function ScanHome() {
  const router = useRouter();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();
  const [scans, setScans] = useState<ScanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const fetchScans = useCallback(async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;
    const data = await getScans(token, activeProfile.id);
    setScans(data);
  }, [activeProfile, getToken]);

  useEffect(() => {
    setScans([]);
    setLoading(true);
    fetchScans().finally(() => setLoading(false));
  }, [fetchScans]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchScans();
    setRefreshing(false);
  }, [fetchScans]);

  const handleDeleteCancel = useCallback(() => {
    if (deletingScanId) {
      swipeableRefs.current.get(deletingScanId)?.close();
    }
    setDeletingScanId(null);
  }, [deletingScanId]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingScanId) return;
    setDeleteLoading(true);
    const token = await getToken();
    if (!token) return;
    await deleteScan(token, deletingScanId);
    setScans((prev) => prev.filter((s) => s.id !== deletingScanId));
    setDeleteLoading(false);
    setDeletingScanId(null);
  }, [deletingScanId, getToken]);

  const renderScanCard = useCallback(
    ({ item }: { item: ScanData }) => {
      const status = item.processingStatus || "pending";
      const bookCount = countBooks(item);

      return (
        <SwipeToDelete
          ref={(ref) => {
            if (ref) swipeableRefs.current.set(item.id, ref);
            else swipeableRefs.current.delete(item.id);
          }}
          onDelete={() => setDeletingScanId(item.id)}
        >
          <TouchableOpacity
            style={styles.scanCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/(main)/(tabs)/scan-detail?id=${item.id}`)}
          >
            {item.imageUrl && (
              <Image
                source={{ uri: getImageUrl(item.imageUrl) }}
                style={styles.scanThumb}
                resizeMode="cover"
              />
            )}
            <View style={styles.scanInfo}>
              <Text style={styles.scanDate}>{formatDate(item.createdAt)}</Text>
              <View style={styles.scanMeta}>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] || colors.inkLight }]}>
                  <Text style={styles.statusText}>{STATUS_LABELS[status] || status}</Text>
                </View>
                {bookCount > 0 && (
                  <Text style={styles.bookCount}>
                    {bookCount} book{bookCount !== 1 ? "s" : ""}
                  </Text>
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
      <Text style={styles.header}>Find Your Next Read</Text>
      <Text style={styles.headerSubtitle}>
        Snap a photo of any bookshelf and we'll pick the best books for you
      </Text>

      <TouchableOpacity
        style={styles.ctaButton}
        activeOpacity={0.85}
        onPress={() => router.push("/(main)/camera")}
      >
        <Text style={styles.ctaEmoji}>📷</Text>
        <Text style={styles.ctaText}>Scan a Bookshelf</Text>
      </TouchableOpacity>

      {scans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📖</Text>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptySubtitle}>
            Take a photo of a bookshelf to discover great reads!
          </Text>
        </View>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(item) => item.id}
          renderItem={renderScanCard}
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
        visible={deletingScanId !== null}
        title="Delete Scan?"
        message="This will remove the scan and any book history linked to it."
        confirmLabel="Delete"
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
    marginBottom: spacing.xs,
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginBottom: spacing.lg,
    lineHeight: 21,
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
  scanCard: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadows.card,
  },
  scanThumb: {
    width: 80,
    height: 80,
  },
  scanInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: "center",
  },
  scanDate: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
    marginBottom: spacing.xs,
  },
  scanMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: 11,
    fontFamily: fonts.badge,
    color: colors.inkDark,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  bookCount: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
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
