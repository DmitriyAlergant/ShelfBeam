import { useClerk } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View, StyleSheet, Text } from "react-native";
import { colors, fonts } from "../lib/theme";

export default function SSOCallbackScreen() {
  const { handleRedirectCallback } = useClerk();
  const router = useRouter();

  useEffect(() => {
    handleRedirectCallback({
      afterSignInUrl: "/(main)/profile-picker",
      afterSignUpUrl: "/(main)/profile-picker",
    }).then(() => {
      router.replace("/(main)/profile-picker");
    });
  }, [handleRedirectCallback, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.beamYellow} />
      <Text style={styles.text}>Completing sign in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.bgCream,
    gap: 16,
  },
  text: {
    fontFamily: fonts.body,
    color: colors.inkMedium,
    fontSize: 16,
  },
});
