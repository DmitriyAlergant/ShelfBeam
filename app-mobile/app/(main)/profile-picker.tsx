import { useContext } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActiveReaderContext, type ReaderProfile } from "./_layout";

const PLACEHOLDER_PROFILES: ReaderProfile[] = [
  { id: "1", name: "Emma", color: "#6C63FF" },
  { id: "2", name: "Jake", color: "#FF6B6B" },
];

export default function ProfilePicker() {
  const { setActiveReader } = useContext(ActiveReaderContext);

  const handleSelect = (profile: ReaderProfile) => {
    setActiveReader(profile);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Who's Reading?</Text>
        <Text style={styles.subtitle}>Pick your reader profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {PLACEHOLDER_PROFILES.map((profile) => (
          <TouchableOpacity
            key={profile.id}
            style={styles.card}
            onPress={() => handleSelect(profile)}
            activeOpacity={0.8}
          >
            <View
              style={[styles.avatar, { backgroundColor: profile.color }]}
            >
              <Text style={styles.avatarLetter}>
                {profile.name.charAt(0)}
              </Text>
            </View>
            <Text style={styles.profileName}>{profile.name}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addCard} activeOpacity={0.8}>
          <View style={styles.addCircle}>
            <Text style={styles.addPlus}>+</Text>
          </View>
          <Text style={styles.addLabel}>Add Reader</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFF8F0",
  },
  header: {
    alignItems: "center",
    paddingTop: 48,
    paddingBottom: 32,
  },
  emoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2D2D2D",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 20,
    paddingBottom: 40,
  },
  card: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  profileName: {
    fontSize: 17,
    fontWeight: "600",
    color: "#2D2D2D",
  },
  addCard: {
    width: 140,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 28,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E8E8E8",
    borderStyle: "dashed",
  },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F0F0F5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  addPlus: {
    fontSize: 32,
    fontWeight: "300",
    color: "#8E8E93",
  },
  addLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#8E8E93",
  },
});
