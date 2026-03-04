const API_BASE_URL = (() => {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error("Missing required env EXPO_PUBLIC_API_URL");
  }
  return url;
})();

type FetchOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
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
  birthYear: number | null;
  gender: string | null;
  languages: string[] | null;
  interests: string[] | null;
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
