import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch, setAuthToken, clearAuthToken, getAuthToken } from "../lib/api";

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
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password?: string, name?: string, bypassTraining?: boolean, whatsapp?: string, country?: string, languages?: string, experience?: string) => Promise<void>;
  logout: () => void;
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
  const [impersonatingFrom, setImpersonatingFrom] = useState<User | null>(() => {
    const savedImpersonating = localStorage.getItem("platform_impersonating_from");
    return savedImpersonating ? JSON.parse(savedImpersonating) : null;
  });

  useEffect(() => {
    // Attempt to load session if token exists
    const token = getAuthToken();
    if (token) {
      apiFetch("/api/auth/me").then(userData => {
        setUser(userData);
      }).catch(() => {
        clearAuthToken();
        setUser(null);
      });
    }
  }, []);

  const loadAgents = async () => {
    if (user?.isAdmin) {
      try {
        const data = await apiFetch("/api/agents");
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

  useEffect(() => {
    if (impersonatingFrom) {
      localStorage.setItem("platform_impersonating_from", JSON.stringify(impersonatingFrom));
    } else {
      localStorage.removeItem("platform_impersonating_from");
    }
  }, [impersonatingFrom]);

  const login = async (email: string, password?: string) => {
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setUser(response.user);
      setAuthToken(response.user.token);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Login failed" };
    }
  };

  const register = async (
    email: string, 
    password?: string, 
    name?: string, 
    bypassTraining?: boolean,
    whatsapp?: string,
    country?: string,
    languages?: string,
    experience?: string
  ) => {
    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email, password, name, bypassTraining, whatsapp, country, languages, experience
        })
      });
      setUser(response.user);
      setAuthToken(response.user.token);
    } catch (e: any) {
      throw new Error(e.message || "Registration failed");
    }
  };

  const logout = () => {
    setUser(null);
    setImpersonatingFrom(null);
    clearAuthToken();
    localStorage.removeItem("platform_impersonating_from");
  };

  const passQuiz = async () => {
    if (user) {
      try {
        await apiFetch(`/api/agents/${encodeURIComponent(user.email)}`, {
          method: "PUT",
          body: JSON.stringify({ didPassQuiz: true })
        });
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
        await apiFetch(`/api/agents/${encodeURIComponent(user.email)}`, {
          method: "PUT",
          body: JSON.stringify({ isApproved: true })
        });
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
        await apiFetch(`/api/agents/${encodeURIComponent(user.email)}`, {
          method: "PUT",
          body: JSON.stringify({ avatarUrl: url })
        });
        setUser({ ...user, avatarUrl: url });
        await loadAgents();
      } catch (e) {
         console.error("Failed to update avatar");
      }
    }
  };

  // Admin capabilities
  const updateAgentProfile = async (email: string, data: Partial<Agent>) => {
    try {
      await apiFetch(`/api/agents/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify(data)
      });
      await loadAgents();
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        const res = await apiFetch("/api/auth/me");
        setUser(res);
      }
    } catch (e) {
      console.error("Failed to update agent profile");
    }
  };

  const freezeAgentAccount = async (email: string, freeze: boolean) => {
    try {
      await apiFetch(`/api/agents/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify({ isFrozen: freeze })
      });
      await loadAgents();
      if (freeze && user && user.email.toLowerCase() === email.toLowerCase()) {
        logout();
      }
    } catch (e) {
      console.error("Failed to freeze account");
    }
  };

  const deleteAgentAccount = async (email: string) => {
    try {
      await apiFetch(`/api/agents/${encodeURIComponent(email)}`, {
        method: "DELETE"
      });
      await loadAgents();
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        logout();
      }
    } catch (e) {
       console.error("Failed to delete account");
    }
  };

  const toggleAdminRights = async (email: string, enableAdmin: boolean) => {
    try {
      await apiFetch(`/api/agents/${encodeURIComponent(email)}`, {
        method: "PUT",
        body: JSON.stringify({ isAdmin: enableAdmin })
      });
      await loadAgents();
      if (user && user.email.toLowerCase() === email.toLowerCase()) {
        const res = await apiFetch("/api/auth/me");
        setUser(res);
      }
    } catch (e) {
       console.error("Failed to toggle admin rights");
    }
  };

  const impersonateAgent = (email: string) => {
    const target = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!target) return;

    if (!impersonatingFrom && user) {
      setImpersonatingFrom(user);
    }

    const impersonatedUser = {
      email: target.email,
      name: target.name,
      isApproved: target.isApproved,
      didPassQuiz: target.didPassQuiz,
      isAdmin: target.isAdmin,
      isSuperAdmin: target.isSuperAdmin,
      avatarUrl: target.avatarUrl
    };

    setUser(impersonatedUser);
  };

  const stopImpersonation = () => {
    if (impersonatingFrom) {
      setUser(impersonatingFrom);
      setImpersonatingFrom(null);
      localStorage.removeItem("platform_impersonating_from");
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      agents, 
      impersonatingFrom,
      loadAgents,
      login, 
      register, 
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

