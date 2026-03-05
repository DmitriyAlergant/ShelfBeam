import { Platform } from "react-native";

const API_BASE_URL = (() => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error("Missing required env EXPO_PUBLIC_API_URL");
  }
  return url;
})();

const DEV_AUTH_BYPASS = process.env.EXPO_PUBLIC_DEV_AUTH_BYPASS === "true";

const DEV_ADMIN_API_KEY = (() => {
  if (!DEV_AUTH_BYPASS) return "";
  const key = process.env.EXPO_PUBLIC_DEV_ADMIN_API_KEY;
  if (!key) throw new Error("Missing required env EXPO_PUBLIC_DEV_ADMIN_API_KEY");
  return key;
})();

const DEV_TEST_USER_ID = (() => {
  if (!DEV_AUTH_BYPASS) return "";
  const id = process.env.EXPO_PUBLIC_DEV_TEST_USER_ID;
  if (!id) throw new Error("Missing required env EXPO_PUBLIC_DEV_TEST_USER_ID");
  return id;
})();

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token, headers: extraHeaders } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (DEV_AUTH_BYPASS) {
    headers["X-Admin-Key"] = DEV_ADMIN_API_KEY;
    headers["X-Admin-User-Id"] = DEV_TEST_USER_ID;
  } else if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `API error ${res.status}`);
  }

  return res.json();
}

async function apiUpload<T>(path: string, formData: FormData, token: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (DEV_AUTH_BYPASS) {
    headers["X-Admin-Key"] = DEV_ADMIN_API_KEY;
    headers["X-Admin-User-Id"] = DEV_TEST_USER_ID;
  } else if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `API error ${res.status}`);
  }

  return res.json();
}

// User sync
export function syncUser(token: string) {
  return apiFetch<{ id: string; clerkId: string }>("/api/users/sync", {
    method: "POST",
    token,
  });
}

// Profiles
export type ProfileData = {
  id: string;
  userId: string;
  name: string;
  avatarKey: string | null;
  age: number | null;
  grade: number | null;
  gender: string | null;
  languages: string[] | null;
  interests: string[] | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export function getProfiles(token: string) {
  return apiFetch<ProfileData[]>("/api/profiles", { token });
}

export function createProfile(
  token: string,
  data: { name: string; avatar_key: string }
) {
  return apiFetch<ProfileData>("/api/profiles", {
    method: "POST",
    token,
    body: data,
  });
}

export function deleteProfile(token: string, profileId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/profiles/${profileId}`, {
    method: "DELETE",
    token,
  });
}

export function updateProfile(
  token: string,
  profileId: string,
  data: Partial<{
    name: string;
    avatar_key: string;
    age: number;
    grade: number;
    gender: string;
    languages: string[];
    interests: string[];
    notes: string;
  }>
) {
  return apiFetch<ProfileData>(`/api/profiles/${profileId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

// Scans
export type ScanData = {
  id: string;
  readerProfileId: string;
  imageUrl: string | null;
  processingStatus: string | null;
  readerComment: string | null;
  detectedBooks: DetectedBook[] | null;
  recommendation: ScanRecommendation | null;
  recommendationSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DetectedBook = {
  title: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
  confidence?: number;
  book_id?: string;
};

export type ScanRecommendationPick = {
  title: string;
  author?: string;
  reason: string;
  rank?: number;
  crop_url?: string;
  book_id?: string;
  obb?: number[][];
};

export type ScanRecommendation = ScanRecommendationPick[] | { text: string; top_picks?: string[] };

export async function uploadScanImage(token: string, imageUri: string): Promise<{ image_url: string }> {
  const formData = new FormData();
  const filename = imageUri.split("/").pop() || "photo.jpg";
  const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
  const mimeType = ext === "png" ? "image/png" : "image/jpeg";

  if (Platform.OS === "web") {
    const response = await fetch(imageUri);
    const blob = await response.blob();
    formData.append("image", blob, filename);
  } else {
    formData.append("image", {
      uri: imageUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);
  }

  return apiUpload<{ image_url: string }>("/api/scans/upload", formData, token);
}

export function createScan(
  token: string,
  data: { reader_profile_id: string; image_url: string; reader_comment?: string }
) {
  return apiFetch<ScanData>("/api/scans", {
    method: "POST",
    token,
    body: data,
  });
}

export function getScans(token: string, readerProfileId: string) {
  return apiFetch<ScanData[]>(`/api/scans?reader_profile_id=${readerProfileId}`, { token });
}

export function getScan(token: string, scanId: string) {
  return apiFetch<ScanData>(`/api/scans/${scanId}`, { token });
}

export function deleteScan(token: string, scanId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/scans/${scanId}`, {
    method: "DELETE",
    token,
  });
}

export function cancelScan(token: string, scanId: string) {
  return apiFetch<{ status: string }>(`/api/scans/${scanId}/cancel`, {
    method: "POST",
    token,
  });
}

export function updateScan(
  token: string,
  scanId: string,
  data: Partial<{
    processing_status: string;
    processing_task_id: string | null;
    detected_books: DetectedBook[] | null;
    recommendation: ScanRecommendation | null;
    recommendation_summary: string | null;
    reader_comment: string | null;
  }>
) {
  return apiFetch<ScanData>(`/api/scans/${scanId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

// Books
export type BookData = {
  id: string;
  title: string;
  author: string | null;
  isbn: string | null;
  coverUrl: string | null;
  isSeries: boolean | null;
  rawMetadata: unknown;
  createdAt: string;
};

export function createBook(
  token: string,
  data: { title: string; author?: string; isbn?: string; cover_url?: string; is_series?: boolean }
) {
  return apiFetch<BookData>("/api/books", {
    method: "POST",
    token,
    body: data,
  });
}

export function getBook(token: string, bookId: string) {
  return apiFetch<BookData>(`/api/books/${bookId}`, { token });
}

// Book History
export type HistoryEntry = {
  id: string;
  readerProfileId: string;
  bookId: string;
  source: string;
  sourceId: string | null;
  comment: string | null;
  reactions: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type HistoryWithBook = {
  entry: HistoryEntry;
  book: BookData;
};

export function getHistory(token: string, profileId: string) {
  return apiFetch<HistoryWithBook[]>(`/api/profiles/${profileId}/history`, { token });
}

export function addToHistory(
  token: string,
  profileId: string,
  data: { book_id: string; source: string; source_id?: string; status?: string; reactions?: string[]; comment?: string }
) {
  return apiFetch<HistoryEntry>(`/api/profiles/${profileId}/history`, {
    method: "POST",
    token,
    body: data,
  });
}

export function updateHistoryEntry(
  token: string,
  profileId: string,
  entryId: string,
  data: Partial<{ reactions: string[]; status: string; comment: string }>
) {
  return apiFetch<HistoryEntry>(`/api/profiles/${profileId}/history/${entryId}`, {
    method: "PATCH",
    token,
    body: data,
  });
}

export function deleteHistoryEntry(token: string, profileId: string, entryId: string) {
  return apiFetch<{ deleted: boolean }>(`/api/profiles/${profileId}/history/${entryId}`, {
    method: "DELETE",
    token,
  });
}

// Reading Log
export type ParsedBookEntry = {
  title: string;
  author?: string;
  is_series?: boolean;
  inferred_status?: string | null;
  inferred_reactions?: string[] | null;
  comment?: string | null;
  entry_type: "new" | "update";
  existing_history_entry_id?: string | null;
};

export async function parseReadingLog(token: string, text: string, profileId: string): Promise<ParsedBookEntry[]> {
  const res = await apiFetch<{ parsed: ParsedBookEntry[]; raw_input: string }>("/api/reading-log/parse", {
    method: "POST",
    token,
    body: { text, profile_id: profileId },
  });
  return res.parsed;
}

// Helpers
export function getImageUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
