import { useSignIn, useSSO } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { authStyles } from "../../lib/auth-styles";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      void WebBrowser.warmUpAsync();
      return () => {
        void WebBrowser.coolDownAsync();
      };
    }
  }, []);

  const onSSOPress = useCallback(
    async (strategy: "oauth_google" | "oauth_apple") => {
      setSsoLoading(strategy);
      setError(null);
      try {
        if (Platform.OS === "web") {
          // Web: use signIn.sso() for redirect-based flow (popups get blocked)
          if (!signIn) throw new Error("Sign in not loaded");
          await signIn.create({ strategy, redirectUrl: "/sso-callback" });
          const { firstFactorVerification } = signIn;
          const redirectUrl =
            firstFactorVerification?.externalVerificationRedirectURL;
          if (redirectUrl) {
            window.location.href = redirectUrl.toString();
          }
          return;
        }
        // Native: use expo-web-browser based SSO flow
        const redirectUrl = Linking.createURL("/(auth)/sign-in");
        const { createdSessionId, setActive: ssoSetActive } =
          await startSSOFlow({ strategy, redirectUrl });

        if (createdSessionId && ssoSetActive) {
          await ssoSetActive({ session: createdSessionId });
          router.replace("/(main)/profile-picker");
        }
      } catch (err: any) {
        const msg =
          err?.errors?.[0]?.longMessage || err?.message || "Sign in failed";
        setError(msg);
      } finally {
        setSsoLoading(null);
      }
    },
    [signIn, startSSOFlow, router],
  );

  const onSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setLoading(false);
        router.replace("/(main)/profile-picker");
      } else {
        setError(`Sign in incomplete (status: ${result.status}). Please try again.`);
        setLoading(false);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || "Sign in failed";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>📚</Text>
          </View>
          <Text style={styles.title}>BookBeam</Text>
          <Text style={styles.subtitle}>Discover your next great read</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.ssoButton, ssoLoading === "oauth_google" && styles.buttonDisabled]}
            onPress={() => onSSOPress("oauth_google")}
            disabled={!!ssoLoading || loading}
          >
            {ssoLoading === "oauth_google" ? (
              <ActivityIndicator color={colors.inkDark} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.inkDark} />
                <Text style={styles.ssoButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {Platform.OS === "ios" && (
            <TouchableOpacity
              style={[styles.ssoButtonDark, ssoLoading === "oauth_apple" && styles.buttonDisabled]}
              onPress={() => onSSOPress("oauth_apple")}
              disabled={!!ssoLoading || loading}
            >
              {ssoLoading === "oauth_apple" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={22} color="#fff" />
                  <Text style={styles.ssoButtonTextLight}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.inkLight}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.inkLight}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onSignIn}
            disabled={loading || !!ssoLoading}
          >
            {loading ? (
              <ActivityIndicator color={colors.inkDark} />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Don&apos;t have an account? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.beamYellow,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadows.button,
  },
  button: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    ...shadows.button,
  },
  buttonText: {
    color: colors.inkDark,
    fontSize: 17,
    fontFamily: fonts.headingSemiBold,
  },
});

const styles = { ...authStyles, ...localStyles };
