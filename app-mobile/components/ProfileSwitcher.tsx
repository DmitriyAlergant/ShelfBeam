import { useRouter } from "expo-router";
import { useAppAuth } from "../lib/auth";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, shadows, spacing } from "../lib/theme";
import { useAppContext } from "../lib/AppContext";
import { getProfiles, deleteProfile, type ProfileData } from "../lib/api";
import { DiceBearAvatar } from "./DiceBearAvatar";

export function ProfileSwitcher() {
  const insets = useSafeAreaInsets();
  const { activeProfile, setActiveProfile, pendingSave } = useAppContext();
  const { signOut, getToken } = useAppAuth();
  const router = useRouter();
  const [savingFromBar, setSavingFromBar] = useState(false);

  const [showSheet, setShowSheet] = useState(false);
  const [profiles, setProfiles] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(false);

  const openSheet = useCallback(async () => {
    setShowSheet(true);
    setLoading(true);
    const token = await getToken();
    if (!token) return;
    const data = await getProfiles(token);
    setProfiles(data);
    setLoading(false);
  }, [getToken]);

  const handleSwitch = (profile: ProfileData) => {
    setActiveProfile(profile);
    setShowSheet(false);
  };

  const handleDelete = (profile: ProfileData) => {
    Alert.alert(
      "Delete Reader Profile",
      `Are you sure you want to permanently delete "${profile.name}"?\n\nThis will remove all their reading history, scans, and recommendations. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) return;
              await deleteProfile(token, profile.id);
              setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
              if (activeProfile?.id === profile.id) {
                setActiveProfile(null);
                setShowSheet(false);
                router.replace("/(main)/profile-picker");
              }
            } catch {
              Alert.alert("Error", "Failed to delete profile. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleSwitchReader = () => {
    setShowSheet(false);
    setActiveProfile(null);
    router.replace("/(main)/profile-picker");
  };

  if (!activeProfile) return null;

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={openSheet}
          activeOpacity={0.7}
        >
          <DiceBearAvatar
            seed={activeProfile.avatarKey || activeProfile.name}
            size={32}
            active
          />
          <Text style={styles.profileName} numberOfLines={1}>
            {activeProfile.name}
          </Text>
          <Text style={styles.chevron}>▾</Text>
        </TouchableOpacity>

        {pendingSave && (
          <TouchableOpacity
            style={[styles.saveButton, savingFromBar && styles.saveButtonDisabled]}
            disabled={savingFromBar}
            onPress={async () => {
              setSavingFromBar(true);
              try {
                await pendingSave();
              } catch {
                Alert.alert("Save Error", "Your changes could not be saved.");
              } finally {
                setSavingFromBar(false);
              }
            }}
          >
            {savingFromBar ? (
              <ActivityIndicator size="small" color={colors.inkDark} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={showSheet} animationType="slide" transparent>
        <View style={sheetStyles.overlay}>
          <TouchableOpacity
            style={sheetStyles.backdrop}
            onPress={() => setShowSheet(false)}
            activeOpacity={1}
          />
          <View style={sheetStyles.sheet}>
            <View style={sheetStyles.handle} />
            <Text style={sheetStyles.title}>Switch Reader</Text>

            {loading ? (
              <ActivityIndicator
                size="large"
                color={colors.beamYellow}
                style={{ marginVertical: spacing.xl }}
              />
            ) : (
              <ScrollView
                contentContainerStyle={sheetStyles.list}
                showsVerticalScrollIndicator={false}
              >
                {profiles.map((profile) => (
                  <View key={profile.id} style={sheetStyles.itemRow}>
                    <TouchableOpacity
                      style={[
                        sheetStyles.item,
                        profile.id === activeProfile.id &&
                          sheetStyles.activeItem,
                      ]}
                      onPress={() => handleSwitch(profile)}
                    >
                      <DiceBearAvatar
                        seed={profile.avatarKey || profile.name}
                        size={44}
                        active={profile.id === activeProfile.id}
                      />
                      <Text style={sheetStyles.itemName}>{profile.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={sheetStyles.deleteButton}
                      onPress={() => handleDelete(profile)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <View style={sheetStyles.deleteCircle}>
                        <Text style={sheetStyles.deleteX}>{"\u00d7"}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={sheetStyles.switchButton}
              onPress={handleSwitchReader}
            >
              <Text style={sheetStyles.switchText}>
                Manage Readers
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={sheetStyles.logoutButton}
              onPress={() => { setShowSheet(false); signOut(); }}
            >
              <Text style={sheetStyles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.bgCream,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.bgWarm,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    color: colors.inkDark,
    maxWidth: 150,
  },
  chevron: {
    fontSize: 14,
    color: colors.inkMedium,
  },
  saveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.beamYellow,
    ...shadows.button,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.inkDark,
  },
});

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(45,35,25,0.4)",
  },
  sheet: {
    backgroundColor: colors.bgCream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: "60%",
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
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  item: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  deleteButton: {
    padding: spacing.sm,
  },
  deleteCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.spineCoral,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteX: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    lineHeight: 22,
    marginTop: -1,
  },
  activeItem: {
    backgroundColor: colors.beamYellowLight,
  },
  itemName: {
    fontSize: 18,
    fontFamily: fonts.headingSemiBold,
    color: colors.inkDark,
  },
  switchButton: {
    marginTop: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.bgWarm,
  },
  switchText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.shelfBrown,
  },
  logoutButton: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    alignItems: "center",
  },
  logoutText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.spineCoral,
  },
});
