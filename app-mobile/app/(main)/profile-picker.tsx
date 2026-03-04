import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import { useUserSync } from "../../lib/useUserSync";
import { getProfiles, createProfile, type ProfileData } from "../../lib/api";
import { DiceBearAvatar } from "../../components/DiceBearAvatar";
import { AvatarPicker } from "../../components/AvatarPicker";

export default function ProfilePickerScreen() {
  useUserSync();

  const { getToken } = useAuth();
  const { appUserId, setActiveProfile } = useAppContext();
  const router = useRouter();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchProfiles = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const data = await getProfiles(token);
    setProfiles(data);
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    if (appUserId) {
      fetchProfiles();
    }
  }, [appUserId, fetchProfiles]);

  const handleSelect = (profile: ProfileData) => {
    setActiveProfile(profile);
    router.replace("/(main)/(tabs)");
  };

  const handleProfileCreated = (newProfile: ProfileData) => {
    setProfiles((prev) => [...prev, newProfile]);
    setShowAddModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>👋</Text>
        <Text style={styles.title}>Who's Reading?</Text>
        <Text style={styles.subtitle}>Pick your reader profile</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.beamYellow} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {profiles.map((profile) => (
            <TouchableOpacity
              key={profile.id}
              style={styles.card}
              onPress={() => handleSelect(profile)}
              activeOpacity={0.8}
            >
              <DiceBearAvatar
                seed={profile.avatarKey || profile.name}
                size={72}
              />
              <Text style={styles.profileName}>{profile.name}</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.addCard}
            activeOpacity={0.8}
            onPress={() => setShowAddModal(true)}
          >
            <View style={styles.addCircle}>
              <Text style={styles.addPlus}>+</Text>
            </View>
            <Text style={styles.addLabel}>Add Reader</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <AddProfileModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleProfileCreated}
      />
    </SafeAreaView>
  );
}

function AddProfileModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (profile: ProfileData) => void;
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState(
    () => Math.random().toString(36).substring(2, 10)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a name");
      return;
    }
    setSaving(true);
    setError(null);

    const token = await getToken();
    if (!token) return;

    const profile = await createProfile(token, {
      name: name.trim(),
      avatar_key: avatarSeed,
    });
    setSaving(false);
    setName("");
    onCreated(profile);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />
          <Text style={modalStyles.title}>New Reader</Text>

          {error && (
            <View style={modalStyles.errorBox}>
              <Text style={modalStyles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={modalStyles.input}
            placeholder="Reader's name"
            placeholderTextColor={colors.inkLight}
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Text style={modalStyles.label}>Choose an avatar</Text>
          <AvatarPicker
            value={avatarSeed}
            onSelect={setAvatarSeed}
            avatarSize={56}
          />

          <View style={modalStyles.actions}>
            <TouchableOpacity
              style={modalStyles.cancelButton}
              onPress={onClose}
            >
              <Text style={modalStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                modalStyles.saveButton,
                saving && modalStyles.buttonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.inkDark} />
              ) : (
                <Text style={modalStyles.saveText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  header: {
    alignItems: "center",
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 32,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: 20,
    paddingBottom: 40,
  },
  card: {
    width: 140,
    backgroundColor: colors.bgSurface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.card,
  },
  profileName: {
    fontSize: 17,
    fontFamily: fonts.contentHeadingMedium,
    color: colors.inkDark,
    marginTop: spacing.md,
  },
  addCard: {
    width: 140,
    backgroundColor: colors.bgCream,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.inkLight,
    borderStyle: "dashed",
  },
  addCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
  },
  addPlus: {
    fontSize: 32,
    fontFamily: fonts.heading,
    color: colors.inkLight,
  },
  addLabel: {
    fontSize: 17,
    fontFamily: fonts.headingSemiBold,
    color: colors.inkMedium,
    marginTop: spacing.md,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45,35,25,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bgCream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.inkLight,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.badge,
    color: colors.inkMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  errorBox: {
    backgroundColor: colors.coralLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.spineCoral,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    textAlign: "center",
  },
  input: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: fonts.body,
    color: colors.inkDark,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.subtle,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.bgWarm,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.beamYellow,
    ...shadows.button,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  saveText: {
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    color: colors.inkDark,
  },
});
