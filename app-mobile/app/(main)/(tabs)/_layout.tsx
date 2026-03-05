import { Tabs } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, shadows, spacing } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { Redirect } from "expo-router";
import { ProfileSwitcher } from "../../../components/ProfileSwitcher";

export default function TabsLayout() {
  const { activeProfile } = useAppContext();

  if (!activeProfile) {
    return <Redirect href="/(main)/profile-picker" />;
  }

  return (
    <>
      <ProfileSwitcher />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.inkDark,
          tabBarInactiveTintColor: colors.inkLight,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
          tabBarIconStyle: { marginBottom: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scan",
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📷" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="books"
          options={{
            title: "My Books",
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="📚" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused }) => (
              <TabIcon emoji="👤" focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="scan-detail"
          options={{ href: null }}
        />
      </Tabs>
    </>
  );
}

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconFocused]}>
      <Text style={styles.iconEmoji}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCream,
    borderTopWidth: 2,
    borderTopColor: colors.shelfBrown,
    ...shadows.tabBar,
    height: 88,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.badge,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  iconFocused: {
    backgroundColor: "rgba(255,210,52,0.3)",
  },
  iconEmoji: {
    fontSize: 22,
  },
});
