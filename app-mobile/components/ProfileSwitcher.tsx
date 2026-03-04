import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, shadows, spacing } from "../lib/theme";
import { useAppContext } from "../lib/AppContext";
import { getProfiles, type ProfileData } from "../lib/api";
import { DiceBearAvatar } from "./DiceBearAvatar";

export function ProfileSwitcher() {
  const insets = useSafeAreaInsets();
  const { activeProfile, setActiveProfile } = useAppContext();
  const { signOut, getToken } = useAuth();
  const router = useRouter();

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

  const handleSwitchReader = () => {
    setShowSheet(false);
    setActiveProfile(null);
    router.replace("/(main)/profile-picker");
  };

  if (!activeProfile) return null;

  return (
    <>
      <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
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
          <Ionicons name="chevron-down" size={16} color={colors.inkMedium} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => signOut()}
          style={styles.logoutButton}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.spineCoral} />
        </TouchableOpacity>
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
                  <TouchableOpacity
                    key={profile.id}
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
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={sheetStyles.switchButton}
              onPress={handleSwitchReader}
            >
              <Text style={sheetStyles.switchText}>
                Change Reader or Add New
              </Text>
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
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  profileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontFamily: fonts.contentHeadingMedium,
    color: colors.inkDark,
    maxWidth: 150,
  },
  logoutButton: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  activeItem: {
    backgroundColor: colors.beamYellowLight,
  },
  itemName: {
    fontSize: 18,
    fontFamily: fonts.contentHeadingMedium,
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
});
