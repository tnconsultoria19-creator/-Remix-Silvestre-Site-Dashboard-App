import React, { createContext, useContext, useState, useEffect } from "react";
import { useI18n } from "./I18nContext";

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
  addLead: (lead: Partial<Lead>) => void;
  updateLead: (id: string, updated: Partial<Lead>) => void;
  claimLead: (id: string, agentEmail: string) => void;
  unclaimLead: (id: string) => void;
  reassignLead: (id: string, agentEmail: string) => void;
  addLeadNote: (leadId: string, text: string, author: string) => void;
  addLeadCustomField: (leadId: string, title: string, value: string) => void;
  uploadLeadFile: (leadId: string, fileName: string, fileUrl: string, uploadedBy: string) => void;
  issueCommissionPayment: (leadId: string, proofName: string, proofUrl: string) => void;
  removeNotification: (id: string) => void;
  
  // Conversion helper
  convertPrice: (amountInUSD: number, targetCurrency?: string) => { symbol: string; value: number; formatted: string };

  // Global Currency Config
  globalCurrency: "USD" | "EUR" | "BRL" | "MZN" | "ZAR";
  setGlobalCurrency: (curr: "USD" | "EUR" | "BRL" | "MZN" | "ZAR") => void;

  // Lead deletions
  deleteLead: (id: string) => void;
}

const JobsContext = createContext<JobsContextType | undefined>(undefined);

const initialLeads: Lead[] = [];

export function JobsProvider({ children }: { children: React.ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>(() => {
    const savedLeads = localStorage.getItem("platform_leads");
    if (savedLeads) {
      try {
        return JSON.parse(savedLeads);
      } catch (e) {
        return initialLeads;
      }
    }
    localStorage.setItem("platform_leads", JSON.stringify(initialLeads));
    return initialLeads;
  });

  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Enforce master global currency (default "USD")
  const [globalCurrency, setGlobalCurrency] = useState<"USD" | "EUR" | "BRL" | "MZN" | "ZAR">(() => {
    return (localStorage.getItem("global_currency") as any) || "USD";
  });

  useEffect(() => {
    localStorage.setItem("global_currency", globalCurrency);
  }, [globalCurrency]);

  useEffect(() => {
    localStorage.setItem("platform_leads", JSON.stringify(leads));
  }, [leads]);

  const addLead = (lead: Partial<Lead>) => {
    const randomId = "L-" + Math.floor(1000 + Math.random() * 9000);
    const newLead: Lead = {
      id: randomId,
      name: lead.name || "Unnamed Prospect",
      industry: lead.industry || "General",
      country: lead.country || "United States",
      estValue: lead.estValue || 1500,
      payout: lead.payout || (lead.estValue ? Math.round(lead.estValue * 0.2) : 300),
      earningsCurrency: lead.earningsCurrency || "USD",
      status: lead.status || "Available",
      claimedBy: lead.claimedBy,
      contactPerson: lead.contactPerson || { name: "", email: "", phone: "", role: "" },
      socials: lead.socials || {},
      prototypeUrl: lead.prototypeUrl || "https://example.com",
      notes: [{ id: "n-init", author: "Platform System", text: "Lead registered in marketplace.", date: new Date().toISOString().slice(0, 10) }],
      customFields: lead.customFields || [],
      uploads: [],
      description: lead.description || "",
      isFrozen: false
    };

    setLeads(prev => [newLead, ...prev]);
    setNotifications(prev => [
      { id: Math.random().toString(), message: `New Lead Added: ${newLead.name}` },
      ...prev
    ]);
  };

  const updateLead = (id: string, updated: Partial<Lead>) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updated } : l));
  };

  const deleteLead = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    setNotifications(prev => [
      { id: Math.random().toString(), message: `Lead ${id} has been permanently deleted.` },
      ...prev
    ]);
  };

  const claimLead = (id: string, agentEmail: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === id) {
        if (l.isFrozen) return l; // Do not allow claiming frozen leads
        return {
          ...l,
          status: "Claimed" as const,
          claimedBy: agentEmail,
          notes: [
            ...l.notes,
            { id: Math.random().toString(), author: "Platform System", text: `Opportunity claimed by agent (${agentEmail})`, date: new Date().toISOString().slice(0, 10) }
          ]
        };
      }
      return l;
    }));
  };

  const unclaimLead = (id: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === id) {
        return {
          ...l,
          status: "Available" as const,
          claimedBy: undefined,
          notes: [
            ...l.notes,
            { id: Math.random().toString(), author: "Platform System", text: "Opportunity released back to Marketplace.", date: new Date().toISOString().slice(0, 10) }
          ]
        };
      }
      return l;
    }));
  };

  const reassignLead = (id: string, agentEmail: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === id) {
        const isSelfunclaim = !agentEmail;
        return {
          ...l,
          status: isSelfunclaim ? ("Available" as const) : ("Claimed" as const),
          claimedBy: isSelfunclaim ? undefined : agentEmail,
          notes: [
            ...l.notes,
            { 
              id: Math.random().toString(), 
              author: "Platform System", 
              text: isSelfunclaim ? "Lead claim cancelled by administrator" : `Lead reassigned by administrator to ${agentEmail}`, 
              date: new Date().toISOString().slice(0, 10) 
            }
          ]
        };
      }
      return l;
    }));
  };

  const addLeadNote = (leadId: string, text: string, author: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          notes: [
            ...l.notes,
            { id: Math.random().toString(), author, text, date: new Date().toISOString().slice(0, 10) }
          ]
        };
      }
      return l;
    }));
  };

  const addLeadCustomField = (leadId: string, title: string, value: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          customFields: [
            ...l.customFields,
            { id: Math.random().toString(), title, value }
          ]
        };
      }
      return l;
    }));
  };

  const uploadLeadFile = (leadId: string, fileName: string, fileUrl: string, uploadedBy: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        const newUpload: LeadUpload = {
          id: "upl-" + Math.floor(1000 + Math.random() * 9000),
          name: fileName,
          url: fileUrl,
          date: new Date().toISOString().slice(0, 10),
          uploadedBy
        };
        return {
          ...l,
          uploads: [...l.uploads, newUpload],
          notes: [
            ...l.notes,
            { 
              id: Math.random().toString(), 
              author: uploadedBy, 
              text: `Uploaded File Deliverable: ${fileName}`, 
              date: new Date().toISOString().slice(0, 10) 
            }
          ]
        };
      }
      return l;
    }));
  };

  const issueCommissionPayment = (leadId: string, proofName: string, proofUrl: string) => {
    setLeads(prev => prev.map(l => {
      if (l.id === leadId) {
        return {
          ...l,
          commissionPaid: true,
          commissionPaidDate: new Date().toISOString().slice(0, 10),
          commissionProofName: proofName,
          commissionProofUrl: proofUrl,
          status: "Sold" as const,
          notes: [
            ...l.notes,
            { id: Math.random().toString(), author: "Platform System", text: `Commission Paid successfully. Proof of Payment uploaded: ${proofName}`, date: new Date().toISOString().slice(0, 10) }
          ]
        };
      }
      return l;
    }));
    setNotifications(prev => [
      { id: Math.random().toString(), message: `Commission paid out for lead ${leadId}` },
      ...prev
    ]);
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

