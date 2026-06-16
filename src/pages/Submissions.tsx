import React, { useState } from "react";
import { useJobs } from "../store/JobsContext";
import { useI18n } from "../store/I18nContext";
import { motion } from "motion/react";
import { UploadCloud, FileType, CheckCircle2 } from "lucide-react";
import { getAccessToken } from "../lib/firebase";

export function Submissions() {
  const { leads, uploadLeadFile } = useJobs();
  const { t } = useI18n();
  const [selectedJob, setSelectedJob] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [paymentInfo, setPaymentInfo] = useState("");
  const [notes, setNotes] = useState("");

  const claimedJobs = leads.filter(j => j.status === "Claimed" || j.status === "In Progress");

  const sendGmailNotification = async (token: string, toEmail: string, subject: string, body: string) => {
    try {
      const emailContent = [
        `To: ${toEmail}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        '',
        body
      ].join('\\n');
      const encodedEmail = btoa(emailContent).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
      await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodedEmail })
      });
    } catch (e) {
      console.error("Failed to send email notification", e);
    }
  };

  const uploadToDrive = async (token: string, file: File) => {
    const metadata = {
      name: file.name,
      mimeType: file.type || 'application/pdf',
    };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);
    
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: form
    });
    const data = await res.json();
    return data.id;
  };

  const makeDriveFilePublic = async (token: string, fileId: string) => {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'anyone', role: 'reader' })
    });
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    return data.webViewLink;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedJob) return;

    const token = await getAccessToken();
    if (!token) {
      alert("Missing Google Workspace access token. Please sign out and sign back in to authorize Drive and Gmail.");
      return;
    }

    try {
      // 1. Upload to Drive
      const fileId = await uploadToDrive(token, file);
      
      // 2. Make it public & get URL
      const webViewLink = await makeDriveFilePublic(token, fileId);

      // 3. Update Firestore via JobsContext
      const lead = claimedJobs.find(l => l.id === selectedJob);
      if (lead) {
        await uploadLeadFile(lead.id, file.name, webViewLink, lead.claimedBy || "Agent");

        // 4. Send Gmail Notification
        const adminEmail = "tnconsultoria19@gmail.com";
        const subject = `Ticket Submitted: ${lead.name}`;
        const bodyContent = `Document uploaded: ${file.name}\\nLink: ${webViewLink}\\nNotes: ${notes}\\nPayment Info: ${paymentInfo}`;
        
        // Notify admin
        await sendGmailNotification(token, adminEmail, subject, bodyContent);
        
        // Notify user
        if (lead.claimedBy) {
          await sendGmailNotification(token, lead.claimedBy, "Submission Confirmed", `We have received your submission for ${lead.name}.\\nLink: ${webViewLink}\\nThank you!`);
        }
      }

      setSubmitted(true);
    } catch (e: any) {
      alert("Failed to process submission: " + e.message);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold uppercase tracking-widest text-slate-900">{t("submit.title")}</h1>
      </header>

      {claimedJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 border-dashed p-12 text-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
          You have no active claims. Claim an assignment from the Pool first.
        </div>
      ) : submitted ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-slate-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-900 mx-auto mb-6" />
          <h2 className="text-xl font-bold mb-2 uppercase tracking-wide">Submission Received</h2>
          <p className="text-slate-500 text-sm mb-8">Your deliverables and communication notes will be reviewed for payment clearance.</p>
          <button 
            onClick={() => setSubmitted(false)}
            className="border border-slate-900 text-slate-900 px-6 py-3 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-50 transition-colors"
          >
            Submit Another
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="border border-slate-200 bg-white">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="space-y-4">
              <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                {t("submit.assignment_id")}
              </label>
              <select 
                required
                value={selectedJob}
                onChange={(e) => setSelectedJob(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:border-slate-900 transition-colors uppercase"
              >
                <option value="" disabled>Select Assignment</option>
                {claimedJobs.map(job => (
                  <option key={job.id} value={job.id}>{job.name} - {job.industry}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col h-full">
                <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4">
                  {t("submit.proof")}
                </label>
                <label className="flex-1 border border-dashed border-slate-300 p-8 text-center hover:bg-slate-50 transition-colors cursor-pointer flex flex-col items-center justify-center">
                  <input type="file" className="hidden" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-2" />
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{file ? file.name : "Click to upload PDF"}</span>
                </label>
              </div>
              <div className="flex flex-col h-full">
                 <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4">
                  {t("submit.payment")}
                 </label>
                 <textarea 
                   rows={4}
                   value={paymentInfo}
                   onChange={e => setPaymentInfo(e.target.value)}
                   placeholder="Enter PayPal or Bank details..."
                   className="flex-1 w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:border-slate-900 transition-colors resize-none"
                 />
              </div>
            </div>

            <div>
               <label className="block text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4">
                {t("submit.notes")}
               </label>
               <textarea 
                 rows={4}
                 value={notes}
                 onChange={e => setNotes(e.target.value)}
                 placeholder="Attach client communication logs, issues, or details about the work..."
                 className="w-full px-3 py-2 text-xs border border-slate-200 bg-slate-50 focus:outline-none focus:border-slate-900 transition-colors resize-none"
               />
            </div>
            
            <div className="pt-4 border-t border-slate-100">
              <button
                 type="submit"
                 disabled={!file}
                 className="w-full bg-slate-900 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-widest py-3 hover:bg-black transition-colors"
               >
                 {t("submit.action")}
               </button>
            </div>
          </form>
        </motion.div>
      )}
    </div>
  );
}
