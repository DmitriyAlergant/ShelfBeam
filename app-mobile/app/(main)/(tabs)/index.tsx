import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ScanHome() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Scan a Shelf</Text>

      <TouchableOpacity style={styles.ctaButton} activeOpacity={0.85}>
        <Text style={styles.ctaEmoji}>📷</Text>
        <Text style={styles.ctaText}>Scan a Bookshelf</Text>
      </TouchableOpacity>

      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>📖</Text>
        <Text style={styles.emptyTitle}>No scans yet</Text>
        <Text style={styles.emptySubtitle}>
          Take a photo of a bookshelf to discover great reads!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0",
    paddingHorizontal: 24,
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#2D2D2D",
    marginTop: 16,
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: "#6C63FF",
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    shadowColor: "#6C63FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  ctaEmoji: {
    fontSize: 28,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 80,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D2D2D",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#8E8E93",
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 22,
  },
});
