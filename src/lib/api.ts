// API utility to handle Cloudflare Worker requests

export const API_BASE = import.meta.env.VITE_API_BASE_URL || "https://lead-marketplace-api.your-username.workers.dev";

export function getAuthToken() {
  return localStorage.getItem("token") || "";
}

export function setAuthToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearAuthToken() {
  localStorage.removeItem("token");
}

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}),
    ...options.headers,
  };

  // Prevent overriding Content-Type if we are sending FormData
  if (options.body instanceof FormData) {
    delete (headers as any)["Content-Type"];
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {
      // Not JSON
    }
    throw new Error(errorMessage);
  }

  // Not all responses will be JSON (e.g. 204 No Content)
  if (response.status === 204) {
    return null;
  }
  
  return response.json();
}

export async function getKV(key: string) {
  try {
    const res = await apiFetch(`/api/kv/${key}`);
    return res?.data;
  } catch (e) {
    return null;
  }
}

export async function setKV(key: string, data: any) {
  try {
    await apiFetch(`/api/kv/${key}`, {
      method: "PUT",
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.error("Failed to sync KV", e);
  }
}
