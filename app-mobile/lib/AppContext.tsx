import React, { createContext, useCallback, useContext, useState } from "react";
import type { ProfileData } from "./api";

type AppContextValue = {
  appUserId: string | null;
  setAppUserId: (id: string | null) => void;
  activeProfile: ProfileData | null;
  setActiveProfile: (profile: ProfileData | null) => void;
  pendingSave: (() => Promise<void>) | null;
  setPendingSave: (fn: (() => Promise<void>) | null) => void;
};

const AppContext = createContext<AppContextValue>({
  appUserId: null,
  setAppUserId: () => {},
  activeProfile: null,
  setActiveProfile: () => {},
  pendingSave: null,
  setPendingSave: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState<ProfileData | null>(null);
  const [pendingSaveBox, setPendingSaveBox] = useState<{ fn: (() => Promise<void>) } | null>(null);
  const pendingSave = pendingSaveBox?.fn ?? null;
  const setPendingSave = useCallback((fn: (() => Promise<void>) | null) => setPendingSaveBox(fn ? { fn } : null), []);
  return (
    <AppContext.Provider
      value={{ appUserId, setAppUserId, activeProfile, setActiveProfile, pendingSave, setPendingSave }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
