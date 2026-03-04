import { Redirect, Stack } from "expo-router";
import { useAppAuth } from "../../lib/auth";

export default function MainLayout() {
  const { isSignedIn, isLoaded } = useAppAuth();

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
