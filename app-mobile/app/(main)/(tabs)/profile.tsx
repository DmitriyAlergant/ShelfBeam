import { useAuth } from "@clerk/clerk-expo";
import { useContext } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActiveReaderContext } from "../_layout";

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const { activeReader, setActiveReader } = useContext(ActiveReaderContext);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Reader Profile</Text>

      {activeReader && (
        <View style={styles.profileCard}>
          <View
            style={[styles.avatar, { backgroundColor: activeReader.color }]}
          >
            <Text style={styles.avatarLetter}>
              {activeReader.name.charAt(0)}
            </Text>
          </View>
          <Text style={styles.name}>{activeReader.name}</Text>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Interests</Text>
            <View style={styles.chips}>
              {["Dinosaurs", "Space", "Magic"].map((tag) => (
                <View key={tag} style={styles.chip}>
                  <Text style={styles.chipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reading Level</Text>
            <Text style={styles.sectionValue}>Ages 8-10</Text>
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => setActiveReader(null)}
        >
          <Text style={styles.switchButtonText}>Switch Reader</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => signOut()}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarLetter: {
    fontSize: 36,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#2D2D2D",
    marginBottom: 20,
  },
  section: {
    width: "100%",
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  sectionValue: {
    fontSize: 16,
    color: "#2D2D2D",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#F0EFFF",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipText: {
    color: "#6C63FF",
    fontSize: 14,
    fontWeight: "600",
  },
  actions: {
    marginTop: 24,
    gap: 12,
  },
  switchButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#6C63FF",
  },
  switchButtonText: {
    color: "#6C63FF",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: {
    color: "#FF6B6B",
    fontSize: 16,
    fontWeight: "600",
  },
});
