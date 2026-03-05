import { Tabs } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, fonts, radius, shadows, spacing } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { Redirect } from "expo-router";
import { ProfileSwitcher } from "../../../components/ProfileSwitcher";

const TAB_META: Record<string, { emoji: string }> = {
  index: { emoji: "📚" },
  scan: { emoji: "🔍" },
  profile: { emoji: "👤" },
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { pendingSave } = useAppContext();

  const handleTabPress = (routeName: string, focused: boolean) => {
    if (focused) return;
    if (pendingSave) {
      pendingSave().catch(() => {
        Alert.alert("Save Error", "Your changes could not be saved.");
      });
    }
    navigation.navigate(routeName);
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        if (options.href === null) return null;

        const meta = TAB_META[route.name];
        if (!meta) return null;

        const label = options.title ?? route.name;
        const focused = state.index === index;

        return (
          <Pressable
            key={route.key}
            onPress={() => handleTabPress(route.name, focused)}
            style={[styles.tabButton, focused && styles.tabButtonActive]}
          >
            <View style={styles.emojiWrap}>
              <Text style={styles.tabEmoji}>{meta.emoji}</Text>
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { activeProfile } = useAppContext();

  if (!activeProfile) {
    return <Redirect href="/(main)/profile-picker" />;
  }

  return (
    <>
      <ProfileSwitcher />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: "Reading History" }}
        />
        <Tabs.Screen
          name="scan"
          options={{ title: "Scans" }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: "Profile" }}
        />
        <Tabs.Screen
          name="scan-detail"
          options={{ href: null }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCream,
    borderTopWidth: 2,
    borderTopColor: colors.shelfBrown,
    ...shadows.tabBar,
    flexDirection: "row",
    alignItems: "stretch",
    paddingTop: 0,
    paddingHorizontal: spacing.md,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: 2,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: colors.beamYellow,
  },
  emojiWrap: {
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  tabEmoji: {
    fontSize: 26,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: fonts.badge,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: colors.inkLight,
  },
  tabLabelActive: {
    color: colors.inkDark,
  },
});
