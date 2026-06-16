// API utility to handle Cloudflare Worker requests

export const API_BASE = "";

export function getAuthToken() {
  const name = "token=";
  const decodedCookie = decodeURIComponent(document.cookie);
  const ca = decodedCookie.split(';');
  for(let i = 0; i <ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == ' ') {
      c = c.substring(1);
    }
    if (c.indexOf(name) == 0) {
      return c.substring(name.length, c.length);
    }
  }
  return "";
}

export function setAuthToken(token: string) {
  const d = new Date();
  d.setTime(d.getTime() + (7*24*60*60*1000));
  const expires = "expires="+ d.toUTCString();
  document.cookie = "token=" + token + ";" + expires + ";path=/";
}

export function clearAuthToken() {
  document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
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
      const errorData: any = await response.json();
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
  
  return response.json() as Promise<any>;
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
