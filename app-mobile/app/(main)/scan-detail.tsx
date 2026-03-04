import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import {
  getScan,
  updateScan,
  createBook,
  addToHistory,
  getImageUrl,
  type ScanData,
  type DetectedBook,
} from "../../lib/api";

const PROCESSING_STEPS = [
  { key: "detecting", label: "Finding books...", emoji: "🔍" },
  { key: "reading", label: "Reading spines...", emoji: "📖" },
  { key: "looking_up", label: "Learning...", emoji: "📚" },
  { key: "recommending", label: "Picking favorites...", emoji: "⭐" },
  { key: "done", label: "Ready!", emoji: "✨" },
];

function getStepIndex(status: string | null): number {
  const idx = PROCESSING_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { activeProfile } = useAppContext();

  const [scan, setScan] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [takenBookIds, setTakenBookIds] = useState<Set<string>>(new Set());
  const [imageExpanded, setImageExpanded] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchScan = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    const data = await getScan(token, id);
    setScan(data);
    if (data.readerComment && !comment) {
      setComment(data.readerComment);
    }
    return data;
  }, [id, getToken, comment]);

  useEffect(() => {
    fetchScan().finally(() => setLoading(false));
  }, [fetchScan]);

  // Poll while processing
  useEffect(() => {
    if (!scan) return;
    const isDone = scan.processingStatus === "done" || scan.processingStatus === "error";
    if (isDone) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const token = await getToken();
      if (!token || !id) return;
      const updated = await getScan(token, id);
      setScan(updated);
      if (updated.processingStatus === "done" || updated.processingStatus === "error") {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [scan?.processingStatus, id, getToken]);

  const saveComment = useCallback(async () => {
    if (!id || !comment.trim()) return;
    setSavingComment(true);
    const token = await getToken();
    if (!token) { setSavingComment(false); return; }
    const updated = await updateScan(token, id, { reader_comment: comment.trim() });
    setScan(updated);
    setSavingComment(false);
  }, [id, comment, getToken]);

  const takeBook = useCallback(
    async (detectedBook: DetectedBook) => {
      if (!activeProfile) return;
      const token = await getToken();
      if (!token) return;

      // Create or find the book first
      const book = await createBook(token, {
        title: detectedBook.title,
        author: detectedBook.author,
        isbn: detectedBook.isbn,
        cover_url: detectedBook.cover_url,
      });

      // Add to history
      await addToHistory(token, activeProfile.id, {
        book_id: book.id,
        source: "scan",
        source_id: id,
        status: "reading",
      });

      setTakenBookIds((prev) => new Set([...prev, book.id]));
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    [activeProfile, getToken, id]
  );

  const rerunRecommendation = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    const updated = await updateScan(token, id, {
      processing_status: "recommending",
      recommendation: undefined,
      recommendation_summary: undefined,
    });
    setScan(updated);
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
  const isError = scan.processingStatus === "error";
  const detectedBooks = (scan.detectedBooks || []) as DetectedBook[];

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
              {imageExpanded ? "▲ Collapse" : "▼ Expand"}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Reader comment */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>What are you looking for today?</Text>
        <View style={styles.commentRow}>
          <TextInput
            style={styles.commentInput}
            value={comment}
            onChangeText={setComment}
            placeholder="e.g. Something funny with animals..."
            placeholderTextColor={colors.inkLight}
            onBlur={saveComment}
            returnKeyType="done"
            onSubmitEditing={saveComment}
          />
          {savingComment && <ActivityIndicator size="small" color={colors.beamYellow} />}
        </View>
      </View>

      {/* Processing stepper */}
      {!isDone && !isError && (
        <View style={styles.section}>
          <View style={styles.stepper}>
            {PROCESSING_STEPS.map((step, idx) => {
              const isActive = idx === currentStep;
              const isComplete = idx < currentStep;
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
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                  {idx < PROCESSING_STEPS.length - 1 && (
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
          {currentStep < 4 && (
            <ActivityIndicator
              size="small"
              color={colors.beamYellow}
              style={{ marginTop: spacing.md }}
            />
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

      {/* Detected books */}
      {detectedBooks.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Books Found</Text>
          {detectedBooks.map((book, idx) => {
            const isTaken = book.book_id ? takenBookIds.has(book.book_id) : false;
            return (
              <View
                key={`${book.title}-${idx}`}
                style={[
                  styles.bookCard,
                  { transform: [{ rotate: idx % 2 === 0 ? "0.5deg" : "-0.5deg" }] },
                ]}
              >
                {book.cover_url ? (
                  <Image
                    source={{ uri: book.cover_url }}
                    style={styles.bookCover}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.bookCoverPlaceholder}>
                    <Text style={styles.bookCoverEmoji}>📕</Text>
                  </View>
                )}
                <View style={styles.bookInfo}>
                  <Text style={styles.bookTitle} numberOfLines={2}>
                    {book.title}
                  </Text>
                  {book.author && (
                    <Text style={styles.bookAuthor} numberOfLines={1}>
                      {book.author}
                    </Text>
                  )}
                  {book.confidence != null && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(book.confidence * 100)}% match
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.takeButton, isTaken && styles.takeButtonDone]}
                  onPress={() => !isTaken && takeBook(book)}
                  disabled={isTaken}
                >
                  <Text style={[styles.takeText, isTaken && styles.takeTextDone]}>
                    {isTaken ? "Added ✓" : "Take this one"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Recommendation panel */}
      {(scan.recommendation || scan.recommendationSummary) && isDone && (
        <View style={styles.recoCard}>
          <View style={styles.recoHeader}>
            <Text style={styles.recoEmoji}>⭐</Text>
            <Text style={styles.recoTitle}>Our Picks for You</Text>
          </View>
          {scan.recommendationSummary && (
            <Text style={styles.recoText}>{scan.recommendationSummary}</Text>
          )}
          {scan.recommendation && typeof scan.recommendation === "object" && "text" in scan.recommendation && (
            <Text style={styles.recoText}>{scan.recommendation.text}</Text>
          )}
          <TouchableOpacity style={styles.rerunButton} onPress={rerunRecommendation}>
            <Text style={styles.rerunText}>🔄 Get New Picks</Text>
          </TouchableOpacity>
        </View>
      )}
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
  sectionLabel: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
    marginBottom: spacing.sm,
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
    fontSize: 10,
    fontFamily: fonts.badge,
    color: colors.inkLight,
    textAlign: "center",
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
  bookCover: {
    width: 48,
    height: 64,
    borderRadius: radius.sm,
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
  confidenceBadge: {
    backgroundColor: colors.tealLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: fonts.badge,
    color: colors.pageTeal,
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
  recoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recoEmoji: {
    fontSize: 24,
  },
  recoTitle: {
    fontSize: 18,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  recoText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkDark,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  rerunButton: {
    alignSelf: "flex-start",
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  rerunText: {
    fontSize: 13,
    fontFamily: fonts.headingMedium,
    color: colors.inkDark,
  },
});
