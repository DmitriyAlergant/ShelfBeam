import { useSignUp, useSSO } from "@clerk/clerk-expo";
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
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");
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
        const { createdSessionId, setActive: ssoSetActive } =
          await startSSOFlow({ strategy });

        if (createdSessionId && ssoSetActive) {
          await ssoSetActive({ session: createdSessionId });
          router.replace("/(main)/profile-picker");
        }
      } catch (err: any) {
        const msg =
          err?.errors?.[0]?.longMessage || err?.message || "Sign up failed";
        setError(msg);
      } finally {
        setSsoLoading(null);
      }
    },
    [startSSOFlow, router],
  );

  const onSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);

    await signUp.create({ emailAddress: email, password });

    await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    setPendingVerification(true);
    setLoading(false);
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError(null);

    const result = await signUp.attemptEmailAddressVerification({ code });

    if (result.status === "complete") {
      await setActive({ session: result.createdSessionId });
      setLoading(false);
      router.replace("/(main)/profile-picker");
    } else {
      setError("Verification incomplete. Please try again.");
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
          <Text style={styles.subtitle}>Create your account</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {!pendingVerification ? (
            <>
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
                onPress={onSignUp}
                disabled={loading || !!ssoLoading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bgCream} />
                ) : (
                  <Text style={styles.buttonText}>Sign Up</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.verifyText}>
                We sent a verification code to {email}
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={colors.inkLight}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={onVerify}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.bgCream} />
                ) : (
                  <Text style={styles.buttonText}>Verify Email</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <View style={styles.linkRow}>
            <Text style={styles.linkLabel}>Already have an account? </Text>
            <Link href="/(auth)/sign-in" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.spineCoral,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
    shadowColor: colors.spineCoral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  logoEmoji: {
    fontSize: 44,
  },
  title: {
    fontSize: 40,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  errorBox: {
    backgroundColor: colors.coralLight,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.spineCoral,
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    textAlign: "center",
  },
  verifyText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
  },
  ssoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  ssoButtonDark: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.inkDark,
    borderRadius: radius.md,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  ssoButtonText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.inkDark,
  },
  ssoButtonTextLight: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: "#fff",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.inkLight,
    opacity: 0.4,
  },
  dividerText: {
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkLight,
  },
  input: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },
  button: {
    backgroundColor: colors.spineCoral,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    shadowColor: colors.spineCoral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.bgCream,
    fontSize: 17,
    fontFamily: fonts.headingSemiBold,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  linkLabel: {
    color: colors.inkMedium,
    fontSize: 15,
    fontFamily: fonts.body,
  },
  link: {
    color: colors.shelfBrown,
    fontSize: 15,
    fontFamily: fonts.bodyBold,
  },
});
