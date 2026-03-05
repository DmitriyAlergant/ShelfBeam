import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppAuth } from "../../../lib/auth";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import {
  getScan,
  updateScan,
  createBook,
  addToHistory,
  getImageUrl,
  type ScanData,
  type DetectedBook,
} from "../../../lib/api";

const PROCESSING_STEPS = [
  { key: "pending", label: "In queue", emoji: "⏳" },
  { key: "detecting", label: "Finding books", emoji: "🔍" },
  { key: "reading", label: "Reading spines", emoji: "📖" },
  { key: "looking_up", label: "Learning", emoji: "📚" },
  { key: "recommending", label: "Picking favorites", emoji: "⭐" },
];

const TERMINAL_STATUSES = ["done", "error", "failed"];

function getStepIndex(status: string | null): number {
  const idx = PROCESSING_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();

  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [takenBookKeys, setTakenBookKeys] = useState<Set<string>>(new Set());
  const [imageExpanded, setImageExpanded] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commentTouched = useRef(false);

  const commentInitialized = useRef(false);

  const fetchScan = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    const data = await getScan(token, id);
    setScan(data);
    if (data.readerComment != null && !commentInitialized.current && !commentTouched.current) {
      setComment(data.readerComment);
      commentInitialized.current = true;
    }
    return data;
  }, [id, getToken]);

  useEffect(() => {
    fetchScan().finally(() => setLoading(false));
  }, [fetchScan]);

  // Poll while processing
  useEffect(() => {
    if (!scan) return;
    const isDone = TERMINAL_STATUSES.includes(scan.processingStatus ?? "");
    if (isDone) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const token = await getToken();
      if (!token || !id) return;
      const updated = await getScan(token, id);
      setScan(updated);
      if (TERMINAL_STATUSES.includes(updated.processingStatus ?? "")) {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scan?.processingStatus, id, getToken]);

  const saveComment = useCallback(async () => {
    if (!id) return;
    setSavingComment(true);
    const token = await getToken();
    if (!token) { setSavingComment(false); return; }
    const updated = await updateScan(token, id, { reader_comment: comment.trim() || null });
    setScan(updated);
    setSavingComment(false);
  }, [id, comment, getToken]);

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);
      toastOpacity.setValue(0);
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => setToastMessage(null));
    },
    [toastOpacity]
  );

  const bookKey = (b: DetectedBook) => `${b.title}::${b.author ?? ""}`;

  const takeBook = useCallback(
    async (detectedBook: DetectedBook) => {
      if (!activeProfile) return;
      const key = bookKey(detectedBook);

      // Optimistic update
      setTakenBookKeys((prev) => new Set([...prev, key]));

      try {
        const token = await getToken();
        if (!token) throw new Error("No token");

        const book = await createBook(token, {
          title: detectedBook.title,
          author: detectedBook.author,
          isbn: detectedBook.isbn,
          cover_url: detectedBook.cover_url,
        });

        await addToHistory(token, activeProfile.id, {
          book_id: book.id,
          source: "scan",
          source_id: id,
          status: "reading",
        });

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        showToast(`"${detectedBook.title}" added to your reading list!`);
      } catch {
        // Revert optimistic update on failure
        setTakenBookKeys((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
        showToast("Failed to add book. Try again.");
      }
    },
    [activeProfile, getToken, id, showToast]
  );

  const rerunRecommendation = useCallback(async () => {
    if (!id) return;
    // Immediately clear results locally so UI shows processing state
    setScan((prev) => prev ? {
      ...prev,
      processingStatus: "pending",
      recommendation: null,
      recommendationSummary: null,
      detectedBooks: null,
    } : prev);
    const token = await getToken();
    if (!token) return;
    // Reset to pending with null task_id so the worker picks it up fresh
    await updateScan(token, id, {
      processing_status: "pending",
      processing_task_id: null,
      detected_books: null,
      recommendation: null,
      recommendation_summary: null,
    });
  }, [id, getToken]);

  if (loading || !scan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.beamYellow} />
      </View>
    );
  }

  const currentStep = getStepIndex(scan.processingStatus);
  const isDone = scan.processingStatus === "done";
  const isError = scan.processingStatus === "error" || scan.processingStatus === "failed";
  const detectedBooks = (scan.detectedBooks || []) as DetectedBook[];

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
    >
      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace("/scan")}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* Shelf image (collapsible) */}
      {scan.imageUrl && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setImageExpanded(!imageExpanded)}
        >
          <Image
            source={{ uri: getImageUrl(scan.imageUrl) }}
            style={imageExpanded ? styles.shelfImageExpanded : styles.shelfImageCollapsed}
            resizeMode="cover"
          />
          <View style={styles.imageToggle}>
            <Text style={styles.imageToggleText}>
              {imageExpanded ? "⌃" : "⌄"}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Processing stepper */}
      {!isDone && !isError && (() => {
        const windowStart = currentStep > 0 ? 1 : 0;
        const visibleSteps = PROCESSING_STEPS.slice(windowStart);
        return (
          <View style={styles.section}>
            <View style={styles.stepper}>
              {visibleSteps.map((step, visIdx) => {
                const globalIdx = windowStart + visIdx;
                const isActive = globalIdx === currentStep;
                const isComplete = globalIdx < currentStep;
                return (
                  <View key={step.key} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        isActive && styles.stepCircleActive,
                        isComplete && styles.stepCircleComplete,
                      ]}
                    >
                      <Text style={styles.stepEmoji}>
                        {isComplete ? "✓" : step.emoji}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        isActive && styles.stepLabelActive,
                        isComplete && styles.stepLabelComplete,
                      ]}
                    >
                      {step.label}
                    </Text>
                    {visIdx < visibleSteps.length - 1 && (
                      <View
                        style={[
                          styles.stepLine,
                          isComplete && styles.stepLineComplete,
                        ]}
                      />
                    )}
                  </View>
                );
              })}
            </View>
            <ActivityIndicator
              size="small"
              color={colors.beamYellow}
              style={{ marginTop: spacing.md }}
            />
          </View>
        );
      })()}

      {/* Error state */}
      {isError && (
        <View style={styles.errorCard}>
          <Text style={styles.errorEmoji}>😕</Text>
          <Text style={styles.errorText}>
            Something went wrong while processing this shelf.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={rerunRecommendation}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results (only when done) */}
      {isDone && scan.recommendationSummary && (
        <View style={styles.section}>
          {/* 1. Heading */}
          <Text style={styles.sectionTitle}>
            {Array.isArray(scan.recommendation) && scan.recommendation.length > 0
              ? "Our Picks for You"
              : "Hmm..."}
          </Text>

          {/* 2. Ranked book cards */}
          {Array.isArray(scan.recommendation) && scan.recommendation.map((pick, i) => {
            const pickAsBook: DetectedBook = { title: pick.title, author: pick.author };
            const isTaken = takenBookKeys.has(bookKey(pickAsBook));
            const rank = pick.rank ?? i + 1;
            return (
              <View key={i} style={styles.bookCard}>
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{rank}</Text>
                </View>
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>{pick.title}</Text>
                  {pick.author && (
                    <Text style={styles.bookAuthor} numberOfLines={1}>{pick.author}</Text>
                  )}
                  {pick.reason && (
                    <Text style={styles.pickReason} numberOfLines={2}>{pick.reason}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.takeButton, isTaken && styles.takeButtonDone]}
                  onPress={() => !isTaken && takeBook(pickAsBook)}
                  disabled={isTaken}
                >
                  <Text style={[styles.takeText, isTaken && styles.takeTextDone]}>
                    {isTaken ? "Added ✓" : "Take"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* 0-reco fallback */}
          {Array.isArray(scan.recommendation) && scan.recommendation.length === 0 && (
            <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryText}>Try Another Shelf</Text>
            </TouchableOpacity>
          )}

          {/* 3. Summary comment */}
          <View style={styles.recoCard}>
            <Text style={styles.recoText}>{scan.recommendationSummary}</Text>
          </View>

          {/* 4. Note input + refresh */}
          <View style={styles.commentRow}>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={(text) => { commentTouched.current = true; setComment(text); }}
              placeholder="Any special wishes? e.g. Something funny with animals..."
              placeholderTextColor={colors.inkLight}
              onBlur={saveComment}
              returnKeyType="done"
              onSubmitEditing={saveComment}
            />
            {savingComment && <ActivityIndicator size="small" color={colors.beamYellow} />}
          </View>
          <TouchableOpacity style={styles.refreshRecoButton} onPress={rerunRecommendation}>
            <Text style={styles.refreshRecoText}>Refresh Recommendations</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Note input while still processing (before results) */}
      {!isDone && !isError && (
        <View style={styles.section}>
          <View style={styles.commentRow}>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={(text) => { commentTouched.current = true; setComment(text); }}
              placeholder="Any special wishes? e.g. Something funny with animals..."
              placeholderTextColor={colors.inkLight}
              onBlur={saveComment}
              returnKeyType="done"
              onSubmitEditing={saveComment}
            />
            {savingComment && <ActivityIndicator size="small" color={colors.beamYellow} />}
          </View>
        </View>
      )}

    </ScrollView>

      {/* Toast notification */}
      {toastMessage && (
        <Animated.View style={[styles.toast, { opacity: toastOpacity, bottom: insets.bottom + 20 }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  scrollView: {
    flex: 1,
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

  // Shelf image
  shelfImageExpanded: {
    width: "100%",
    height: 220,
  },
  shelfImageCollapsed: {
    width: "100%",
    height: 80,
  },
  imageToggle: {
    alignItems: "center",
    paddingVertical: spacing.xs,
    backgroundColor: colors.bgWarm,
  },
  imageToggleText: {
    fontSize: 12,
    fontFamily: fonts.body,
    color: colors.inkMedium,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.md,
  },

  // Comment
  commentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },

  // Processing stepper
  stepper: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  stepItem: {
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  stepCircleActive: {
    backgroundColor: colors.beamYellow,
    ...shadows.button,
  },
  stepCircleComplete: {
    backgroundColor: colors.pageTeal,
  },
  stepEmoji: {
    fontSize: 16,
  },
  stepLabel: {
    fontSize: 12,
    fontFamily: fonts.badge,
    color: colors.inkLight,
    textAlign: "center",
    paddingHorizontal: 2,
  },
  stepLabelActive: {
    color: colors.inkDark,
  },
  stepLabelComplete: {
    color: colors.pageTeal,
  },
  stepLine: {
    position: "absolute",
    top: 18,
    left: "60%",
    right: "-40%",
    height: 2,
    backgroundColor: colors.bgWarm,
  },
  stepLineComplete: {
    backgroundColor: colors.pageTeal,
  },

  // Error
  errorCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.coralLight,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.spineCoral,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontSize: 14,
    fontFamily: fonts.heading,
    color: "#fff",
  },

  // Book cards
  bookCard: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.beamYellow,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.shelfBrown,
  },
  bookInfo: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  bookTitle: {
    fontSize: 15,
    fontFamily: fonts.headingMedium,
    color: colors.inkDark,
  },
  bookAuthor: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: 2,
  },
  pickReason: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    fontStyle: "italic",
    marginTop: 4,
    lineHeight: 18,
  },
  takeButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  takeButtonDone: {
    backgroundColor: colors.tealLight,
  },
  takeText: {
    fontSize: 12,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  takeTextDone: {
    color: colors.pageTeal,
  },

  // Recommendation
  recoCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.beamYellowLight,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.beamYellow,
  },
  recoText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  refreshRecoButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.pageTeal,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  refreshRecoText: {
    fontSize: 13,
    fontFamily: fonts.headingMedium,
    color: "#fff",
  },

  // Toast
  toast: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.shelfBrown,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    ...shadows.card,
  },
  toastText: {
    fontSize: 14,
    fontFamily: fonts.headingMedium,
    color: "#fff",
    textAlign: "center",
  },
});
