import React, { createContext, useContext, useState } from "react";
import type { ProfileData } from "./api";

type AppContextValue = {
  appUserId: string | null;
  setAppUserId: (id: string | null) => void;
  activeProfile: ProfileData | null;
  setActiveProfile: (profile: ProfileData | null) => void;
};

const AppContext = createContext<AppContextValue>({
  appUserId: null,
  setAppUserId: () => {},
  activeProfile: null,
  setActiveProfile: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProfileData | null>(null);

  return (
    <AppContext.Provider
      value={{ appUserId, setAppUserId, activeProfile, setActiveProfile }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
