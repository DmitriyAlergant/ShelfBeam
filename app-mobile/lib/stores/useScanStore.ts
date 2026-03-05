import { create } from "zustand";
import {
  getScans,
  getScan,
  updateScan,
  deleteScan,
  type ScanData,
} from "../api";

type ScanStore = {
  scans: ScanData[];
  loading: boolean;
  profileId: string | null;

  fetchScans: (token: string, profileId: string) => Promise<void>;
  fetchScan: (token: string, scanId: string) => Promise<void>;
  addScan: (scan: ScanData) => void;
  updateScan: (
    token: string,
    scanId: string,
    data: Parameters<typeof updateScan>[2]
  ) => Promise<ScanData>;
  removeScan: (token: string, scanId: string) => Promise<void>;
  patchScanLocal: (scanId: string, partial: Partial<ScanData>) => void;
  reset: () => void;
};

export const useScanStore = create<ScanStore>((set, get) => ({
  scans: [],
  loading: true,
  profileId: null,

  fetchScans: async (token, profileId) => {
    if (get().profileId !== profileId) {
      set({ scans: [], profileId });
    }
    const data = await getScans(token, profileId);
    set({ scans: data, loading: false, profileId });
  },

  fetchScan: async (token, scanId) => {
    const data = await getScan(token, scanId);
    set((s) => {
      const idx = s.scans.findIndex((sc) => sc.id === scanId);
      if (idx >= 0) {
        const next = [...s.scans];
        next[idx] = data;
        return { scans: next };
      }
      return { scans: [data, ...s.scans] };
    });
  },

  addScan: (scan) => {
    set((s) => ({ scans: [scan, ...s.scans] }));
  },

  updateScan: async (token, scanId, data) => {
    const updated = await updateScan(token, scanId, data);
    set((s) => ({
      scans: s.scans.map((sc) => (sc.id === scanId ? updated : sc)),
    }));
    return updated;
  },

  removeScan: async (token, scanId) => {
    await deleteScan(token, scanId);
    set((s) => ({ scans: s.scans.filter((sc) => sc.id !== scanId) }));
  },

  patchScanLocal: (scanId, partial) => {
    set((s) => ({
      scans: s.scans.map((sc) =>
        sc.id === scanId ? { ...sc, ...partial } : sc
      ),
    }));
  },

  reset: () => set({ scans: [], loading: true, profileId: null }),
}));
