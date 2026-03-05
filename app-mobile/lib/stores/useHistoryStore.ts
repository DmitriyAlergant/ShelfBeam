import { create } from "zustand";
import {
  getHistory,
  updateHistoryEntry,
  deleteHistoryEntry,
  type HistoryWithBook,
} from "../api";

type HistoryStore = {
  entries: HistoryWithBook[];
  loading: boolean;
  profileId: string | null;

  fetchHistory: (token: string, profileId: string) => Promise<void>;
  addEntry: (entry: HistoryWithBook) => void;
  updateEntry: (
    token: string,
    profileId: string,
    entryId: string,
    data: Parameters<typeof updateHistoryEntry>[3]
  ) => Promise<void>;
  removeEntry: (
    token: string,
    profileId: string,
    entryId: string
  ) => Promise<void>;
  reset: () => void;
};

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [],
  loading: true,
  profileId: null,

  fetchHistory: async (token, profileId) => {
    if (get().profileId !== profileId) {
      set({ entries: [], profileId });
    }
    const data = await getHistory(token, profileId);
    set({ entries: data, loading: false, profileId });
  },

  addEntry: (entry) => {
    set((s) => ({ entries: [entry, ...s.entries] }));
  },

  updateEntry: async (token, profileId, entryId, data) => {
    const updatedEntry = await updateHistoryEntry(token, profileId, entryId, data);
    set((s) => ({
      entries: s.entries.map((e) =>
        e.entry.id === entryId ? { ...e, entry: { ...e.entry, ...updatedEntry } } : e
      ),
    }));
  },

  removeEntry: async (token, profileId, entryId) => {
    await deleteHistoryEntry(token, profileId, entryId);
    set((s) => ({
      entries: s.entries.filter((e) => e.entry.id !== entryId),
    }));
  },

  reset: () => set({ entries: [], loading: true, profileId: null }),
}));
