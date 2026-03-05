import { useRouter } from "expo-router";
import { useAppAuth } from "../../lib/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ConfirmModal from "../../components/ConfirmModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import { useUserSync } from "../../lib/useUserSync";
import { getProfiles, createProfile, deleteProfile, type ProfileData } from "../../lib/api";
import { DiceBearAvatar } from "../../components/DiceBearAvatar";
import { AvatarPicker } from "../../components/AvatarPicker";

export default function ProfilePickerScreen() {
  useUserSync();

  const { getToken } = useAppAuth();
  const { appUserId, activeProfile, setActiveProfile } = useAppContext();
  const router = useRouter();

  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editing, setEditing] = useState(false);
  const editStartedAt = useRef(0);
  const [deletingProfile, setDeletingProfile] = useState<ProfileData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingProfile) return;
    setDeleteLoading(true);
    const token = await getToken();
    if (!token) return;
    await deleteProfile(token, deletingProfile.id);
    setProfiles((prev) => prev.filter((p) => p.id !== deletingProfile.id));
    if (activeProfile?.id === deletingProfile.id) {
      setActiveProfile(null);
    }
    setDeleteLoading(false);
    setDeletingProfile(null);
  }, [deletingProfile, getToken, activeProfile, setActiveProfile]);

  const handleProfileCreated = (newProfile: ProfileData) => {
    setProfiles((prev) => [...prev, newProfile]);
    setShowAddModal(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.fill} onPress={editing ? () => { if (Date.now() - editStartedAt.current > 300) setEditing(false); } : undefined}>
        <View style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Who&apos;s Reading?</Text>
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
            <View key={profile.id} style={styles.cardWrapper}>
              {editing ? (
                <Pressable style={styles.card} onPress={() => setEditing(false)}>
                  <DiceBearAvatar
                    seed={profile.avatarKey || profile.name}
                    size={72}
                  />
                  <Text style={styles.profileName}>{profile.name}</Text>
                </Pressable>
              ) : (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => handleSelect(profile)}
                  onLongPress={() => { editStartedAt.current = Date.now(); setEditing(true); }}
                  activeOpacity={0.8}
                >
                  <DiceBearAvatar
                    seed={profile.avatarKey || profile.name}
                    size={72}
                  />
                  <Text style={styles.profileName}>{profile.name}</Text>
                </TouchableOpacity>
              )}
              {editing && (
                <TouchableOpacity
                  style={styles.deleteBadge}
                  onPress={() => setDeletingProfile(profile)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.deleteX}>{"\u00d7"}</Text>
                </TouchableOpacity>
              )}
            </View>
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
      </Pressable>

      <AddProfileModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleProfileCreated}
      />

      <ConfirmModal
        visible={deletingProfile !== null}
        title="Delete Reader Profile"
        message={
          deletingProfile
            ? `Permanently delete "${deletingProfile.name}"?\n\nThis will remove all their reading history, scans, and recommendations.`
            : ""
        }
        confirmLabel="Delete Forever"
        destructive
        loading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingProfile(null)}
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
  const { getToken } = useAppAuth();
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
  fill: {
    flex: 1,
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
    paddingTop: 10,
    gap: 20,
    paddingBottom: 40,
    overflow: "visible",
  },
  cardWrapper: {
    position: "relative",
    overflow: "visible",
  },
  card: {
    width: 140,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: "center",
    ...shadows.card,
  },
  deleteBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.spineCoral,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    ...shadows.button,
  },
  deleteX: {
    color: "#fff",
    fontSize: 18,
    fontFamily: fonts.headingSemiBold,
    lineHeight: 24,
    marginTop: -1,
  },
  profileName: {
    fontSize: 17,
    fontFamily: fonts.headingSemiBold,
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
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: fonts.body,
    color: colors.inkDark,
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
