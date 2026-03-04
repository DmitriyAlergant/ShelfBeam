import { useAuth } from "@clerk/clerk-expo";
import { Redirect, Slot } from "expo-router";
import React, { createContext, useState } from "react";

export type ReaderProfile = {
  id: string;
  name: string;
  color: string;
};

export const ActiveReaderContext = createContext<{
  activeReader: ReaderProfile | null;
  setActiveReader: (reader: ReaderProfile | null) => void;
}>({
  activeReader: null,
  setActiveReader: () => {},
});

export default function MainLayout() {
  const { isSignedIn, isLoaded } = useAuth();
  const [activeReader, setActiveReader] = useState<ReaderProfile | null>(null);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  if (!activeReader) {
    const ProfilePicker =
      require("./profile-picker").default as React.ComponentType;
    return (
      <ActiveReaderContext.Provider value={{ activeReader, setActiveReader }}>
        <ProfilePicker />
      </ActiveReaderContext.Provider>
    );
  }

  return (
    <ActiveReaderContext.Provider value={{ activeReader, setActiveReader }}>
      <Slot />
    </ActiveReaderContext.Provider>
  );
}
