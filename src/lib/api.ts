import { db } from "./firebase";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";

export async function getKV(key: string) {
  try {
    const docRef = doc(db, "kv_store", key);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data().value;
    }
    return null;
  } catch (e) {
    console.error("Failed to get KV", e);
    return null;
  }
}

export async function setKV(key: string, data: any) {
  try {
    const docRef = doc(db, "kv_store", key);
    await setDoc(docRef, { value: data });
  } catch (e) {
    console.error("Failed to sync KV", e);
  }
}

// Stub for backward compatibility since some components still call apiFetch
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  if (endpoint === "/api/agents") {
    // Return all users that are agents
    try {
      const snap = await getDocs(collection(db, "users"));
      return snap.docs.map(d => d.data());
    } catch(e) {
      return [];
    }
  }
  return null;
}

export function getAuthToken() { return "legacy-token"; }
export function setAuthToken(token: string) {}
export function clearAuthToken() {}

