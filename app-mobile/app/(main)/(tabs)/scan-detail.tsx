import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Path, Polygon } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppAuth } from "../../../lib/auth";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import {
  createBook,
  addToHistory,
  getImageUrl,
  updateScan,
  type DetectedBook,
  type ScanRecommendationPick,
} from "../../../lib/api";
import { useScanStore } from "../../../lib/stores/useScanStore";
import { useHistoryStore } from "../../../lib/stores/useHistoryStore";

const BEAM_GLOW_COLOR = "rgba(255, 214, 51, 0.7)"; // beamYellow with opacity
const BEAM_GLOW_COLOR_STRONG = "rgba(255, 214, 51, 0.9)";

function BeamOverlay({
  imageUrl,
  obb,
}: {
  imageUrl: string;
  obb: number[][];
}) {
  const [imageNaturalSize, setImageNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const containerWidth = Dimensions.get("window").width - spacing.lg * 2;
  const containerHeight = 260;

  useEffect(() => {
    Image.getSize(
      imageUrl,
      (w, h) => setImageNaturalSize({ w, h }),
      () => {}
    );
  }, [imageUrl]);

  if (!imageNaturalSize) {
    return (
      <View style={{ width: containerWidth, height: containerHeight, backgroundColor: colors.bgWarm, borderRadius: radius.lg }} />
    );
  }

  // Fit image into container (contain mode)
  const imgAspect = imageNaturalSize.w / imageNaturalSize.h;
  const containerAspect = containerWidth / containerHeight;
  let displayW: number, displayH: number, offsetX: number, offsetY: number;
  if (imgAspect > containerAspect) {
    displayW = containerWidth;
    displayH = containerWidth / imgAspect;
    offsetX = 0;
    offsetY = (containerHeight - displayH) / 2;
  } else {
    displayH = containerHeight;
    displayW = containerHeight * imgAspect;
    offsetX = (containerWidth - displayW) / 2;
    offsetY = 0;
  }

  const scaleX = displayW / imageNaturalSize.w;
  const scaleY = displayH / imageNaturalSize.h;

  // Map OBB corners to display coordinates
  const scaledPoints = obb.map(([x, y]) => ({
    x: offsetX + x * scaleX,
    y: offsetY + y * scaleY,
  }));
  const pointsStr = scaledPoints.map((p) => `${p.x},${p.y}`).join(" ");

  // Expand polygon slightly for the outer glow
  const cx = scaledPoints.reduce((s, p) => s + p.x, 0) / scaledPoints.length;
  const cy = scaledPoints.reduce((s, p) => s + p.y, 0) / scaledPoints.length;
  const glowScale = 1.08;
  const glowPoints = scaledPoints
    .map((p) => `${cx + (p.x - cx) * glowScale},${cy + (p.y - cy) * glowScale}`)
    .join(" ");

  return (
    <View style={{ width: containerWidth, height: containerHeight, borderRadius: radius.lg, overflow: "hidden", marginBottom: spacing.md }}>
      <Image
        source={{ uri: imageUrl }}
        style={{ width: containerWidth, height: containerHeight }}
        resizeMode="contain"
      />
      <Svg
        width={containerWidth}
        height={containerHeight}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Dark overlay with cutout for the book (evenodd path) */}
        <Path
          d={`M0,0 H${containerWidth} V${containerHeight} H0 Z ` +
            `M${scaledPoints.map((p) => `${p.x},${p.y}`).join(" L")} Z`}
          fill="rgba(30,25,20,0.55)"
          fillRule="evenodd"
        />
        {/* Outer glow */}
        <Polygon
          points={glowPoints}
          fill="none"
          stroke={BEAM_GLOW_COLOR}
          strokeWidth={8}
          strokeLinejoin="round"
          opacity={0.5}
        />
        {/* Inner bright border — the "beam" */}
        <Polygon
          points={pointsStr}
          fill="none"
          stroke={BEAM_GLOW_COLOR_STRONG}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const WORKFLOW_STEPS = [
  { key: "detecting", label: "Noticing books", emoji: "🔍" },
  { key: "reading", label: "Reading spines", emoji: "📖" },
  { key: "looking_up", label: "Learning", emoji: "📚" },
  { key: "recommending", label: "Picking favorites", emoji: "⭐" },
];

const TERMINAL_STATUSES = ["done", "error", "failed", "cancelled"];

function getWorkflowStepIndex(status: string | null): number {
  const idx = WORKFLOW_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();

  const scan = useScanStore((s) => s.scans.find((sc) => sc.id === id)) ?? null;
  const storeFetchScan = useScanStore((s) => s.fetchScan);
  const storeUpdateScan = useScanStore((s) => s.updateScan);
  const storePatchLocal = useScanStore((s) => s.patchScanLocal);
  const storeCancelScan = useScanStore((s) => s.cancelScan);
  const [loading, setLoading] = useState(!scan);
  const [rerunPending, setRerunPending] = useState(false);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [takenBookKeys, setTakenBookKeys] = useState<Set<string>>(new Set());
  const [imageExpanded, setImageExpanded] = useState(false);
  const [selectedPick, setSelectedPick] = useState<ScanRecommendationPick | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commentTouched = useRef(false);

  const commentInitialized = useRef(false);

  // Reset local state when navigating to a different scan
  useEffect(() => {
    setComment("");
    setTakenBookKeys(new Set());
    commentInitialized.current = false;
    commentTouched.current = false;
  }, [id]);

  const fetchScan = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    await storeFetchScan(token, id);
  }, [id, getToken, storeFetchScan]);

  // Sync comment from scan data when it loads
  useEffect(() => {
    if (scan?.readerComment != null && !commentInitialized.current && !commentTouched.current) {
      setComment(scan.readerComment);
      commentInitialized.current = true;
    }
  }, [scan?.readerComment]);

  useEffect(() => {
    if (!scan) {
      fetchScan().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while processing
  const shouldPoll = rerunPending || !TERMINAL_STATUSES.includes(scan?.processingStatus ?? "");
  useEffect(() => {
    if (!scan || !shouldPoll) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return () => {};
    }

    // Clear rerunPending once polling starts — the poll will track actual status
    if (rerunPending) setRerunPending(false);

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const token = await getToken();
      if (!token || !id) return;
      await storeFetchScan(token, id);
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [shouldPoll, id, getToken, storeFetchScan]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveComment = useCallback(async () => {
    if (!id) return;
    setSavingComment(true);
    const token = await getToken();
    if (!token) { setSavingComment(false); return; }
    // Use updateScan API directly to avoid overwriting scan store state
    // (prevents race with rerunRecommendation)
    await updateScan(token, id, { reader_comment: comment.trim() || null });
    storePatchLocal(id, { readerComment: comment.trim() || null });
    setSavingComment(false);
  }, [id, comment, getToken, storePatchLocal]);

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

        const historyEntry = await addToHistory(token, activeProfile.id, {
          book_id: book.id,
          source: "scan",
          source_id: id,
          status: "reading",
        });

        useHistoryStore.getState().addEntry({ entry: historyEntry, book });

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

  const handleCancel = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    storeCancelScan(token, id);
  }, [id, getToken, storeCancelScan]);

  const rerunRecommendation = useCallback(async () => {
    if (!id) return;
    setRerunPending(true);
    const token = await getToken();
    if (!token) { setRerunPending(false); return; }
    await storeUpdateScan(token, id, {
      processing_status: "pending",
      processing_task_id: null,
    });
  }, [id, getToken, storeUpdateScan]);

  if (loading || !scan) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.beamYellow} />
      </View>
    );
  }

  const effectiveStatus = rerunPending ? "pending" : scan.processingStatus;
  const isPending = effectiveStatus === "pending";
  const workflowStep = getWorkflowStepIndex(effectiveStatus);
  const isDone = effectiveStatus === "done";
  const isError = effectiveStatus === "error" || effectiveStatus === "failed";
  const isCancelled = effectiveStatus === "cancelled";
  const detectedBooks = (scan.detectedBooks || []) as DetectedBook[];

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}
      keyboardShouldPersistTaps="handled"
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

      {/* Processing: queued state OR workflow stepper */}
      {!isDone && !isError && !isCancelled && (
        <View style={styles.section}>
          {isPending ? (
            /* Queued — simple standalone indicator */
            <View style={styles.queuedRow}>
              <ActivityIndicator size="small" color={colors.beamYellow} />
              <Text style={styles.queuedText}>In queue…</Text>
              <TouchableOpacity style={styles.stopBadge} onPress={handleCancel} activeOpacity={0.7}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Active workflow — 4-stage stepper */
            <>
              <View style={styles.stepper}>
                {WORKFLOW_STEPS.map((step, i) => {
                  const isActive = i === workflowStep;
                  const isComplete = i < workflowStep;
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
                      {i < WORKFLOW_STEPS.length - 1 && (
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
              <View style={styles.spinnerRow}>
                <ActivityIndicator size="small" color={colors.beamYellow} />
                <TouchableOpacity style={styles.stopBadge} onPress={handleCancel} activeOpacity={0.7}>
                  <Text style={styles.stopButtonText}>Stop</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

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

      {/* Cancelled state (only when no previous results to show) */}
      {isCancelled && !scan.recommendationSummary && (
        <View style={styles.cancelledCard}>
          <Text style={styles.cancelledEmoji}>&#x270B;</Text>
          <Text style={styles.cancelledText}>Scan processing was stopped</Text>
          <TouchableOpacity style={styles.retryButton} onPress={rerunRecommendation}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results (shown when recommendations exist, even during reprocessing) */}
      {scan.recommendationSummary && (
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
              <TouchableOpacity key={i} activeOpacity={0.7} onPress={() => setSelectedPick(pick)}>
                <View style={styles.bookCard}>
                  {pick.crop_url ? (
                    <View style={styles.cropContainer}>
                      <Image
                        source={{ uri: getImageUrl(pick.crop_url) }}
                        style={styles.bookCropThumb}
                        resizeMode="cover"
                      />
                      <View style={styles.rankBadgeMini}>
                        <Text style={styles.rankTextMini}>{rank}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.rankBadge}>
                      <Text style={styles.rankText}>{rank}</Text>
                    </View>
                  )}
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
              </TouchableOpacity>
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

          {/* 4. Note input + refresh (when done or cancelled with results) */}
          {(isDone || isCancelled) && (
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
              {savingComment ? (
                <ActivityIndicator size="small" color={colors.beamYellow} />
              ) : (
                <Pressable
                  style={styles.refreshRecoButton}
                  onPress={rerunRecommendation}
                  // @ts-ignore – web-only: prevent blur from stealing the first click
                  onMouseDown={(e: any) => e.preventDefault()}
                >
                  <Ionicons name="refresh" size={20} color={colors.inkDark} />
                </Pressable>
              )}
            </View>
          )}
        </View>
      )}

      {/* Note input while still processing (before results) */}
      {!isDone && !isError && !isCancelled && (
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

      {/* Recommendation detail modal */}
      {selectedPick && (() => {
        const pickAsBook: DetectedBook = { title: selectedPick.title, author: selectedPick.author };
        const isTaken = takenBookKeys.has(bookKey(pickAsBook));
        return (
          <Modal
            visible
            transparent
            animationType="slide"
            onRequestClose={() => setSelectedPick(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { paddingBottom: insets.bottom + spacing.lg }]}>
                {/* Close button */}
                <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedPick(null)}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>

                {/* Rank badge */}
                <View style={styles.modalRankBadge}>
                  <Text style={styles.modalRankText}>
                    #{selectedPick.rank ?? 1}
                  </Text>
                </View>

                {/* Beam: shelf photo with highlighted book */}
                {scan.imageUrl && selectedPick.obb && selectedPick.obb.length >= 3 ? (
                  <BeamOverlay
                    imageUrl={getImageUrl(scan.imageUrl)}
                    obb={selectedPick.obb}
                  />
                ) : selectedPick.crop_url ? (
                  <Image
                    source={{ uri: getImageUrl(selectedPick.crop_url) }}
                    style={styles.modalCropImage}
                    resizeMode="contain"
                  />
                ) : null}

                {/* Title & author */}
                <Text style={styles.modalTitle}>{selectedPick.title}</Text>
                {selectedPick.author && (
                  <Text style={styles.modalAuthor}>{selectedPick.author}</Text>
                )}

                {/* Reason */}
                {selectedPick.reason && (
                  <View style={styles.modalReasonCard}>
                    <Text style={styles.modalReasonText}>{selectedPick.reason}</Text>
                  </View>
                )}

                {/* Take button */}
                <TouchableOpacity
                  style={[styles.modalTakeButton, isTaken && styles.modalTakeButtonDone]}
                  onPress={() => {
                    if (!isTaken) takeBook(pickAsBook);
                  }}
                  disabled={isTaken}
                >
                  <Text style={[styles.modalTakeText, isTaken && styles.modalTakeTextDone]}>
                    {isTaken ? "Added to Reading List ✓" : "Take This Book"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        );
      })()}

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

  // Queued state
  queuedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  queuedText: {
    fontSize: 15,
    fontFamily: fonts.headingMedium,
    color: colors.inkMedium,
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

  // Spinner + stop
  spinnerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  stopBadge: {
    backgroundColor: colors.coralLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  stopButtonText: {
    fontSize: 12,
    fontFamily: fonts.badge,
    color: colors.spineCoral,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // Cancelled
  cancelledCard: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  cancelledEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  cancelledText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    marginBottom: spacing.md,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgWarm,
    alignItems: "center",
    justifyContent: "center",
  },

  // Book crop thumbnail in card
  cropContainer: {
    position: "relative",
  },
  bookCropThumb: {
    width: 40,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.bgWarm,
  },
  rankBadgeMini: {
    position: "absolute",
    top: -6,
    left: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.beamYellow,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.button,
  },
  rankTextMini: {
    fontSize: 11,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(45,35,25,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.bgCream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  modalClose: {
    position: "absolute",
    top: spacing.md,
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  modalCloseText: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.inkMedium,
  },
  modalRankBadge: {
    backgroundColor: colors.beamYellow,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
    ...shadows.button,
  },
  modalRankText: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  modalCropImage: {
    width: 120,
    height: 180,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    backgroundColor: colors.bgWarm,
  },
  modalTitle: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  modalAuthor: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  modalReasonCard: {
    backgroundColor: colors.beamYellowLight,
    borderRadius: radius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.beamYellow,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: "100%",
  },
  modalReasonText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    lineHeight: 22,
    fontStyle: "italic",
  },
  modalTakeButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.button,
    marginBottom: spacing.md,
  },
  modalTakeButtonDone: {
    backgroundColor: colors.tealLight,
    shadowOpacity: 0,
  },
  modalTakeText: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  modalTakeTextDone: {
    color: colors.pageTeal,
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
