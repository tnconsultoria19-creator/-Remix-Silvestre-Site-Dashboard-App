import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, googleSignIn, getAccessToken, logoutUser } from "../lib/firebase";
import { doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc, collection, getDocs, writeBatch } from "firebase/firestore";

export interface Agent {
  email: string;
  name: string;
  whatsapp?: string;
  country?: string;
  languages?: string;
  experience?: string;
  isApproved: boolean;
  didPassQuiz: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isFrozen?: boolean;
  avatarUrl?: string;
  uploads?: Array<{ name: string; url: string; date: string }>;
}

export interface User {
  email: string;
  name: string;
  isApproved: boolean;
  didPassQuiz: boolean;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
  isFrozen?: boolean;
  avatarUrl?: string;
}

interface AuthContextType {
  user: User | null;
  agents: Agent[];
  impersonatingFrom: User | null;
  loadAgents: () => Promise<void>;
  login: () => Promise<{ success: boolean; error?: string; user?: User }>;
  logout: () => Promise<void>;
  passQuiz: () => Promise<void>;
  approveUser: () => Promise<void>;
  updateAvatar: (url: string) => Promise<void>;
  
  // Admin functions
  updateAgentProfile: (email: string, data: Partial<Agent>) => Promise<void>;
  freezeAgentAccount: (email: string, freeze: boolean) => Promise<void>;
  deleteAgentAccount: (email: string) => Promise<void>;
  toggleAdminRights: (email: string, enableAdmin: boolean) => Promise<void>;
  impersonateAgent: (email: string) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [impersonatingFrom, setImpersonatingFrom] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser?.email) {
        // Fetch or create user in Firestore
        const userRef = doc(db, "users", firebaseUser.email);
        const userSnap = await getDoc(userRef);
        
        let userData: User;
        if (userSnap.exists()) {
          userData = userSnap.data() as User;
        } else {
          userData = {
            email: firebaseUser.email,
            name: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            isApproved: false,
            didPassQuiz: false,
            isAdmin: false
          };
          await setDoc(userRef, userData);
        }
        setUser(userData);
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const loadAgents = async () => {
    if (user?.isAdmin) {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const data = querySnapshot.docs.map(doc => doc.data() as Agent);
        setAgents(data);
      } catch (e) {
        console.error("Failed to load agents", e);
      }
    }
  };

  useEffect(() => {
    if (user?.isAdmin && !impersonatingFrom) {
      loadAgents();
    }
  }, [user, impersonatingFrom]);

  const login = async () => {
    try {
      const result = await googleSignIn();
      const firebaseUser = result.user;
      if (firebaseUser?.email) {
        const userRef = doc(db, "users", firebaseUser.email);
        const userSnap = await getDoc(userRef);
        let userData: User;
        if (userSnap.exists()) {
          userData = userSnap.data() as User;
        } else {
          userData = {
            email: firebaseUser.email,
            name: firebaseUser.displayName || "",
            isApproved: false,
            didPassQuiz: false,
            isAdmin: false
          };
          await setDoc(userRef, userData);
        }
        setUser(userData);
        return { success: true, user: userData };
      }
      return { success: false, error: "No email returned from Google" };
    } catch (e: any) {
      return { success: false, error: e.message || "Login failed" };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
      setImpersonatingFrom(null);
    } catch (e) {
      console.error(e);
    }
  };

  const passQuiz = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.email), { didPassQuiz: true });
        setUser({ ...user, didPassQuiz: true });
        await loadAgents();
      } catch (e) {
         console.error("Failed to update quiz status");
      }
    }
  };

  const approveUser = async () => {
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.email), { isApproved: true });
        setUser({ ...user, isApproved: true });
        await loadAgents();
      } catch (e) {
         console.error("Failed to approve user");
      }
    }
  };

  const updateAvatar = async (url: string) => {
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.email), { avatarUrl: url });
        setUser({ ...user, avatarUrl: url });
        await loadAgents();
      } catch (e) {
         console.error("Failed to update avatar");
      }
    }
  };

  const updateAgentProfile = async (email: string, data: Partial<Agent>) => {
    try {
      await updateDoc(doc(db, "users", email), data);
      await loadAgents();
      if (user && user.email === email) {
        setUser({ ...user, ...data } as User);
      }
    } catch (e) {
      console.error("Failed to update agent profile");
    }
  };

  const freezeAgentAccount = async (email: string, freeze: boolean) => {
    try {
      await updateDoc(doc(db, "users", email), { isFrozen: freeze });
      await loadAgents();
      if (freeze && user && user.email === email) {
        logout();
      }
    } catch (e) {
      console.error("Failed to freeze account");
    }
  };

  const deleteAgentAccount = async (email: string) => {
    try {
      await deleteDoc(doc(db, "users", email));
      await loadAgents();
      if (user && user.email === email) {
        logout();
      }
    } catch (e) {
       console.error("Failed to delete account");
    }
  };

  const toggleAdminRights = async (email: string, enableAdmin: boolean) => {
    try {
      await updateDoc(doc(db, "users", email), { isAdmin: enableAdmin });
      await loadAgents();
      if (user && user.email === email) {
        setUser({ ...user, isAdmin: enableAdmin });
      }
    } catch (e) {
       console.error("Failed to toggle admin rights");
    }
  };

  const impersonateAgent = (email: string) => {
    const target = agents.find(a => a.email === email);
    if (!target) return;
    if (!impersonatingFrom && user) {
      setImpersonatingFrom(user);
    }
    const impersonatedUser: User = { ...target };
    setUser(impersonatedUser);
  };

  const stopImpersonation = () => {
    if (impersonatingFrom) {
      setUser(impersonatingFrom);
      setImpersonatingFrom(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      agents, 
      impersonatingFrom,
      loadAgents,
      login, 
      logout, 
      passQuiz, 
      approveUser, 
      updateAvatar,
      updateAgentProfile,
      freezeAgentAccount,
      deleteAgentAccount,
      toggleAdminRights,
      impersonateAgent,
      stopImpersonation
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}


