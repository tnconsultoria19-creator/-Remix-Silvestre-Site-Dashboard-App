import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { useI18n } from "../store/I18nContext";

export function Auth() {
  const { login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    const res = await login();
    if (res?.success) {
      if (res.user?.isAdmin || res.user?.isSuperAdmin) {
         navigate("/admin");
      } else {
         navigate("/dashboard");
      }
    } else {
      alert(res?.error || "Login Failed");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center px-4 pt-16 bg-grid-pattern relative">
      <div className="absolute top-0 left-0 w-full h-80 bg-gradient-to-b from-[rgba(0,0,0,0.02)] to-transparent pointer-events-none"></div>
      
      <div className="w-full max-w-[440px] z-10 my-12">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xl mx-auto mb-4 tracking-tighter shadow-[0_4px_16px_rgba(31,109,0,0.3)]">
            <span className="material-symbols-outlined text-[28px]">rocket_launch</span>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface tracking-tight mb-2">
            Secure Member Access
          </h1>
          <p className="text-sm text-on-surface-variant">
            Authenticate using your Google Workspace / Gmail account to sync your documents automatically.
          </p>
        </div>

        <div className="saas-card p-6 sm:p-8 text-center space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="saas-button saas-button-primary w-full py-4 mt-2 flex items-center justify-center gap-2 font-bold text-base"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-[2px]" />
            Sign in with Google
          </button>
          <p className="text-xs text-on-surface-variant mt-4">
            By signing in, you are authorizing access to your Workspace credentials solely for document delivery and workflow automations.
          </p>
        </div>
      </div>
    </div>
  );
}
