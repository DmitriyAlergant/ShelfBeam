import { Tabs } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, shadows, spacing } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { Redirect } from "expo-router";
import { ProfileSwitcher } from "../../../components/ProfileSwitcher";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ICONS: Record<string, { active: IoniconsName; inactive: IoniconsName }> = {
  index: { active: "camera", inactive: "camera-outline" },
  books: { active: "book", inactive: "book-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

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
          tabBarActiveTintColor: colors.shelfBrown,
          tabBarInactiveTintColor: colors.inkLight,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Scan",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? TAB_ICONS.index.active : TAB_ICONS.index.inactive}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="books"
          options={{
            title: "My Books",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? TAB_ICONS.books.active : TAB_ICONS.books.inactive}
                size={24}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? TAB_ICONS.profile.active : TAB_ICONS.profile.inactive}
                size={24}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCream,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    ...shadows.tabBar,
    height: 80,
    paddingTop: spacing.xs,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: fonts.badge,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
