import React, { createContext, useContext, useState, useEffect } from "react";
import { useI18n } from "./I18nContext";
import { apiFetch, getAuthToken } from "../lib/api";

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface Socials {
  linkedin?: string;
  facebook?: string;
  whatsapp?: string;
  twitter?: string;
}

export interface CustomField {
  id: string;
  title: string;
  value: string;
}

export interface LeadNote {
  id: string;
  author: string;
  text: string;
  date: string;
}

export interface LeadUpload {
  id: string;
  name: string;
  url: string;
  date: string;
  uploadedBy: string;
}

export interface Lead {
  id: string;
  name: string;
  industry: string;
  country: string;
  estValue: number; // Stored in USD baseline
  payout: number;    // Stored in USD baseline (Commission)
  earningsCurrency: "USD" | "EUR" | "BRL" | "MZN" | "ZAR";
  status: "Available" | "Claimed" | "In Progress" | "Completed" | "Sold";
  claimedBy?: string; // agent email
  contactPerson: ContactPerson;
  socials: Socials;
  prototypeUrl: string;
  notes: LeadNote[];
  customFields: CustomField[];
  uploads: LeadUpload[];
  
  // Commission Payout
  commissionPaid?: boolean;
  commissionPaidDate?: string;
  commissionProofName?: string;
  commissionProofUrl?: string;

  // New fields
  description?: string;
  isFrozen?: boolean;
}

interface Notification {
  id: string;
  message: string;
}

interface JobsContextType {
  leads: Lead[];
  notifications: Notification[];
  loadLeads: () => Promise<void>;
  addLead: (lead: Partial<Lead>) => Promise<void>;
  updateLead: (id: string, updated: Partial<Lead>) => Promise<void>;
  claimLead: (id: string, agentEmail: string) => Promise<void>;
  unclaimLead: (id: string) => Promise<void>;
  reassignLead: (id: string, agentEmail: string) => Promise<void>;
  addLeadNote: (leadId: string, text: string, author: string) => Promise<void>;
  addLeadCustomField: (leadId: string, title: string, value: string) => Promise<void>;
  uploadLeadFile: (leadId: string, fileName: string, fileUrl: string, uploadedBy: string) => Promise<void>;
  issueCommissionPayment: (leadId: string, proofName: string, proofUrl: string) => Promise<void>;
  removeNotification: (id: string) => void;
  
  // Conversion helper
  convertPrice: (amountInUSD: number, targetCurrency?: string) => { symbol: string; value: number; formatted: string };

  // Global Currency Config
  globalCurrency: "USD" | "EUR" | "BRL" | "MZN" | "ZAR";
  setGlobalCurrency: (curr: "USD" | "EUR" | "BRL" | "MZN" | "ZAR") => void;

  // Lead deletions
  deleteLead: (id: string) => Promise<void>;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Enforce master global currency (default "USD")
  const [globalCurrency, setGlobalCurrency] = useState<"USD" | "EUR" | "BRL" | "MZN" | "ZAR">(("USD"));

  const loadLeads = async () => {
    if (!getAuthToken()) {
      setLeads([]);
      return;
    }
    try {
      const data = await apiFetch("/api/leads");
      setLeads(data);
    } catch (e) {
      console.error("Failed to fetch leads");
    }
  };

  useEffect(() => {
    loadLeads();
  }, []);

  const addLead = async (lead: Partial<Lead>) => {
    try {
      await apiFetch("/api/leads", {
        method: "POST",
        body: JSON.stringify(lead)
      });
      await loadLeads();
      setNotifications(prev => [
        { id: Math.random().toString(), message: `New Lead Added: ${lead.name}` },
        ...prev
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const updateLead = async (id: string, updated: Partial<Lead>) => {
    try {
      await apiFetch(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify(updated)
      });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteLead = async (id: string) => {
    try {
      await apiFetch(`/api/leads/${id}`, {
        method: "DELETE"
      });
      await loadLeads();
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Lead ${id} has been permanently deleted.` },
        ...prev
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  const claimLead = async (id: string, agentEmail: string) => {
    try {
      await apiFetch(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          status: "Claimed", 
          claimedBy: agentEmail,
          newNote: {
            author: "Platform System",
            text: `Opportunity claimed by agent (${agentEmail})`,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const unclaimLead = async (id: string) => {
    try {
      await apiFetch(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          status: "Available", 
          claimedBy: null,
          newNote: {
            author: "Platform System",
            text: `Opportunity released back to Marketplace.`,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const reassignLead = async (id: string, agentEmail: string) => {
    const isSelfunclaim = !agentEmail;
    try {
      await apiFetch(`/api/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify({ 
          status: isSelfunclaim ? "Available" : "Claimed", 
          claimedBy: isSelfunclaim ? null : agentEmail,
          newNote: {
            author: "Platform System",
            text: isSelfunclaim ? "Lead claim cancelled by administrator" : `Lead reassigned by administrator to ${agentEmail}`,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const addLeadNote = async (leadId: string, text: string, author: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          newNote: {
            author,
            text,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
    } catch(e) {
      console.error(e);
    }
  };

  const addLeadCustomField = async (leadId: string, title: string, value: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          newCustomField: { id: Math.random().toString(), title, value }
        })
      });
      await loadLeads();
    } catch(e) {
      console.error(e);
    }
  };

  const uploadLeadFile = async (leadId: string, fileName: string, fileUrl: string, uploadedBy: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          newUpload: {
             id: "upl-" + Math.random().toString(),
             name: fileName,
             url: fileUrl,
             date: new Date().toISOString().slice(0, 10),
             uploadedBy
          },
          newNote: {
            author: uploadedBy,
            text: `Uploaded File Deliverable: ${fileName}`,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const issueCommissionPayment = async (leadId: string, proofName: string, proofUrl: string) => {
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ 
          commissionPaid: true,
          commissionPaidDate: new Date().toISOString().slice(0, 10),
          commissionProofName: proofName,
          commissionProofUrl: proofUrl,
          status: "Sold",
          newNote: {
            author: "Platform System",
            text: `Commission Paid successfully. Proof of Payment uploaded: ${proofName}`,
            date: new Date().toISOString().slice(0, 10)
          }
        })
      });
      await loadLeads();
      setNotifications(prev => [
        { id: Math.random().toString(), message: `Commission paid out for lead ${leadId}` },
        ...prev
      ]);
    } catch(e) {
      console.error(e);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Convert USD Price to display in target currency (ALWAYS defaults to global master currency)
  const convertPrice = (amountInUSD: number, targetCurrency?: string) => {
    const finalCurrency = globalCurrency;
    const rates: Record<string, { symbol: string; rate: number; isSuffix?: boolean }> = {
      USD: { symbol: "$", rate: 1.0 },
      EUR: { symbol: "€", rate: 0.92 },
      BRL: { symbol: "R$", rate: 5.15 },
      MZN: { symbol: " MT", rate: 63.80, isSuffix: true },
      ZAR: { symbol: "R", rate: 18.50 }
    };

    const currencyConfig = rates[finalCurrency] || rates.USD;
    const value = Math.round(amountInUSD * currencyConfig.rate);
    const formatted = currencyConfig.isSuffix 
      ? `${value.toLocaleString()}${currencyConfig.symbol}`
      : `${currencyConfig.symbol}${value.toLocaleString()}`;

    return {
      symbol: currencyConfig.isSuffix ? " MT" : currencyConfig.symbol,
      value,
      formatted
    };
  };

  return (
    <JobsContext.Provider value={{ 
      leads, 
      notifications,
      loadLeads, 
      addLead, 
      updateLead, 
      claimLead, 
      unclaimLead, 
      reassignLead,
      addLeadNote,
      addLeadCustomField,
      uploadLeadFile,
      issueCommissionPayment,
      removeNotification,
      convertPrice,
      globalCurrency,
      setGlobalCurrency,
      deleteLead
    }}>
      {children}
    </JobsContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobsContext);
  if (!context) throw new Error("useJobs must be used within JobsProvider");
  return context;
}

