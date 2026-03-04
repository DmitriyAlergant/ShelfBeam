import React, { createContext, useContext } from "react";
import { ClerkProvider, useAuth } from "@clerk/clerk-expo";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const DEV_AUTH_BYPASS = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === "true";

const CLERK_PUBLISHABLE_KEY = (() => {
  if (DEV_AUTH_BYPASS) return "unused";
  const key = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing required env EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
    );
  }
  return key;
})();

const tokenCache =
  Platform.OS === "web"
    ? {
        async getToken(key: string) {
          return localStorage.getItem(key);
        },
        async saveToken(key: string, value: string) {
          localStorage.setItem(key, value);
        },
      }
    : {
        async getToken(key: string) {
          return SecureStore.getItemAsync(key);
        },
        async saveToken(key: string, value: string) {
          return SecureStore.setItemAsync(key, value);
        },
      };

type AppAuthValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AppAuthContext = createContext<AppAuthValue>({
  isLoaded: false,
  isSignedIn: false,
  getToken: async () => null,
  signOut: async () => {},
});

export function useAppAuth(): AppAuthValue {
  return useContext(AppAuthContext);
}

function ClerkAuthBridge({ children }: { children: React.ReactNode }) {
  const clerk = useAuth();
  const value: AppAuthValue = {
    isLoaded: clerk.isLoaded,
    isSignedIn: !!clerk.isSignedIn,
    getToken: () => clerk.getToken(),
    signOut: () => clerk.signOut(),
  };
  return (
    <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>
  );
}

const devAuthValue: AppAuthValue = {
  isLoaded: true,
  isSignedIn: true,
  getToken: async () => "dev-bypass",
  signOut: async () => {
    console.log("[DevAuthBypass] signOut called — no-op in dev bypass mode");
  },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (DEV_AUTH_BYPASS) {
    return (
      <AppAuthContext.Provider value={devAuthValue}>
        {children}
      </AppAuthContext.Provider>
    );
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
