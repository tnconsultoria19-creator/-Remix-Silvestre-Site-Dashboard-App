import React, { createContext, useContext, useState, useEffect } from "react";

export interface Agent {
  email: string;
  name: string;
  password?: string;
  whatsapp: string;
  country: string;
  languages: string;
  experience: string;
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
  login: (email: string, password?: string) => { success: boolean; error?: string };
  register: (email: string, password?: string, name?: string, bypassTraining?: boolean, whatsapp?: string, country?: string, languages?: string, experience?: string) => void;
  logout: () => void;
  passQuiz: () => void;
  approveUser: () => void;
  updateAvatar: (url: string) => void;
  
  // Admin functions
  updateAgentProfile: (email: string, data: Partial<Agent>) => void;
  freezeAgentAccount: (email: string, freeze: boolean) => void;
  deleteAgentAccount: (email: string) => void;
  toggleAdminRights: (email: string, enableAdmin: boolean) => void;
  impersonateAgent: (email: string) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const defaultAgents: Agent[] = [
  {
    email: "olisbel@gmail.com",
    password: "19921108626",
    name: "Olisbel (Super Admin)",
    whatsapp: "+1000000000",
    country: "United Kingdom",
    languages: "EN, PT",
    experience: "10",
    isApproved: true,
    didPassQuiz: true,
    isAdmin: true,
    isSuperAdmin: true,
    uploads: []
  }
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const savedCurrent = localStorage.getItem("platform_current_user");
    return savedCurrent ? JSON.parse(savedCurrent) : null;
  });

  const [agents, setAgents] = useState<Agent[]>(() => {
    const savedAgents = localStorage.getItem("platform_agents");
    if (savedAgents) {
      try {
        return JSON.parse(savedAgents);
      } catch (e) {
        return defaultAgents;
      }
    }
    localStorage.setItem("platform_agents", JSON.stringify(defaultAgents));
    return defaultAgents;
  });

  const [impersonatingFrom, setImpersonatingFrom] = useState<User | null>(() => {
    const savedImpersonating = localStorage.getItem("platform_impersonating_from");
    return savedImpersonating ? JSON.parse(savedImpersonating) : null;
  });

  useEffect(() => {
    localStorage.setItem("platform_agents", JSON.stringify(agents));
  }, [agents]);

  useEffect(() => {
    if (user) {
      localStorage.setItem("platform_current_user", JSON.stringify(user));
    } else {
      localStorage.removeItem("platform_current_user");
    }
  }, [user]);

  useEffect(() => {
    if (impersonatingFrom) {
      localStorage.setItem("platform_impersonating_from", JSON.stringify(impersonatingFrom));
    } else {
      localStorage.removeItem("platform_impersonating_from");
    }
  }, [impersonatingFrom]);

  const login = (email: string, password?: string) => {
    // Standardize input
    const cleanEmail = email.trim().toLowerCase();

    // Special check for default superadmin Quick Login bypass
    if (cleanEmail === 'olisbel@gmail.com' && (!password || password === '19921108626')) {
      const u = { email: 'olisbel@gmail.com', name: "Olisbel (Super Admin)", isApproved: true, didPassQuiz: true, isAdmin: true, isSuperAdmin: true };
      setUser(u);
      return { success: true };
    }

    // Find agent credentials
    const agent = agents.find(a => a.email.toLowerCase() === cleanEmail);
    if (!agent) {
      return { success: false, error: "Incorrect email or password" };
    }

    if (password && agent.password !== password) {
      return { success: false, error: "Incorrect email or password" };
    }

    if (agent.isFrozen) {
      return { success: false, error: "Your account is frozen. Please contact Super Admin." };
    }

    const u = {
      email: agent.email,
      name: agent.name,
      isApproved: agent.isApproved,
      didPassQuiz: agent.didPassQuiz,
      isAdmin: agent.isAdmin,
      isSuperAdmin: agent.isSuperAdmin,
      avatarUrl: agent.avatarUrl
    };
    
    setUser(u);
    return { success: true };
  };

  const register = (
    email: string, 
    password?: string, 
    name?: string, 
    bypassTraining?: boolean,
    whatsapp?: string,
    country?: string,
    languages?: string,
    experience?: string
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if copy already exists
    if (agents.some(a => a.email.toLowerCase() === cleanEmail)) {
      return;
    }

    const isAdm = cleanEmail === 'olisbel@gmail.com' || cleanEmail.includes('admin');
    const isSuper = cleanEmail === 'olisbel@gmail.com';

    const newAgent: Agent = {
      email: cleanEmail,
      password: password || "password123",
      name: name || cleanEmail.split('@')[0],
      whatsapp: whatsapp || "+0000000000",
      country: country || "Unknown",
      languages: languages || "EN",
      experience: experience || "0",
      isApproved: isAdm || !!bypassTraining,
      didPassQuiz: isAdm || !!bypassTraining,
      isAdmin: isAdm,
      isSuperAdmin: isSuper,
      uploads: []
    };

    setAgents(prev => [...prev, newAgent]);

    const u = {
      email: newAgent.email,
      name: newAgent.name,
      isApproved: newAgent.isApproved,
      didPassQuiz: newAgent.didPassQuiz,
      isAdmin: newAgent.isAdmin,
      isSuperAdmin: newAgent.isSuperAdmin
    };

    setUser(u);
  };

  const logout = () => {
    setUser(null);
    setImpersonatingFrom(null);
    localStorage.removeItem("platform_current_user");
    localStorage.removeItem("platform_impersonating_from");
  };

  const passQuiz = () => {
    if (user) {
      const updatedUser = { ...user, didPassQuiz: true };
      setUser(updatedUser);
      setAgents(prev => prev.map(a => a.email.toLowerCase() === user.email.toLowerCase() ? { ...a, didPassQuiz: true } : a));
    }
  };

  const approveUser = () => {
    if (user) {
      const updatedUser = { ...user, isApproved: true };
      setUser(updatedUser);
      setAgents(prev => prev.map(a => a.email.toLowerCase() === user.email.toLowerCase() ? { ...a, isApproved: true } : a));
    }
  };

  const updateAvatar = (url: string) => {
    if (user) {
      setUser({ ...user, avatarUrl: url });
      setAgents(prev => prev.map(a => a.email.toLowerCase() === user.email.toLowerCase() ? { ...a, avatarUrl: url } : a));
    }
  };

  // Admin capabilities
  const updateAgentProfile = (email: string, data: Partial<Agent>) => {
    setAgents(prev => prev.map(a => {
      if (a.email.toLowerCase() === email.toLowerCase()) {
        // Prevent editing superadmin credentials in key fields unless authorized
        if (a.isSuperAdmin && data.password && email !== user?.email) {
          return a; // reject
        }
        return { ...a, ...data };
      }
      return a;
    }));

    // If edited agent is currently logged in, update logged-in user state too
    if (user && user.email.toLowerCase() === email.toLowerCase()) {
      setUser(prev => prev ? {
        ...prev,
        name: data.name ?? prev.name,
        isApproved: data.isApproved ?? prev.isApproved,
        didPassQuiz: data.didPassQuiz ?? prev.didPassQuiz,
        isAdmin: data.isAdmin ?? prev.isAdmin,
        avatarUrl: data.avatarUrl ?? prev.avatarUrl
      } : null);
    }
  };

  const freezeAgentAccount = (email: string, freeze: boolean) => {
    // Protect superadmin from being frozen
    const target = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (target?.isSuperAdmin) return;

    setAgents(prev => prev.map(a => {
      if (a.email.toLowerCase() === email.toLowerCase()) {
        return { ...a, isFrozen: freeze };
      }
      return a;
    }));

    // If current user is frozen, force logout
    if (freeze && user && user.email.toLowerCase() === email.toLowerCase()) {
      logout();
    }
  };

  const deleteAgentAccount = (email: string) => {
    const target = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (target?.isSuperAdmin) return;

    setAgents(prev => prev.filter(a => a.email.toLowerCase() !== email.toLowerCase()));

    // Force logout if deleting self
    if (user && user.email.toLowerCase() === email.toLowerCase()) {
      logout();
    }
  };

  const toggleAdminRights = (email: string, enableAdmin: boolean) => {
    const target = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (target?.isSuperAdmin) return; // Superadmin is always admin

    setAgents(prev => prev.map(a => {
      if (a.email.toLowerCase() === email.toLowerCase()) {
        return { ...a, isAdmin: enableAdmin };
      }
      return a;
    }));

    // Update session user if self
    if (user && user.email.toLowerCase() === email.toLowerCase()) {
      setUser(prev => prev ? { ...prev, isAdmin: enableAdmin } : null);
    }
  };

  const impersonateAgent = (email: string) => {
    const target = agents.find(a => a.email.toLowerCase() === email.toLowerCase());
    if (!target) return;

    // Save previous admin user
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

