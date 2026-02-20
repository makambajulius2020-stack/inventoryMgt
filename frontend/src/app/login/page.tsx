"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock, Mail, ChevronRight, Hexagon } from "lucide-react";

import { api } from "@/lib/api/client";
import { getLandingRouteForRoles } from "@/lib/auth/roleRouting";
import { useAuth } from "@/contexts/AuthContext";

const MOCK_USERS = [
  { email: "ceo@company.com", label: "Executive CEO", scope: "Global" },
  { email: "auditor@company.com", label: "System Auditor", scope: "Global" },
  { email: "gm.pb@company.com", label: "General Manager", scope: "Patiobela" },
  { email: "finance.pb@company.com", label: "Finance Manager", scope: "Patiobela" },
  { email: "proc.pb@company.com", label: "Procurement", scope: "Patiobela" },
  { email: "store.pb@company.com", label: "Store Manager", scope: "Patiobela" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, logout } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      logout();
      // The mocked auth service only cares about the email
      const session = await api.auth.login({ email, password });
      login(session);
      router.replace(getLandingRouteForRoles([session.user.role]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  const handleQuickLogin = (emailStr: string) => {
    setEmail(emailStr);
    setError(null);
    setSubmitting(true);
    setTimeout(async () => {
      try {
        logout();
        const session = await api.auth.login({ email: emailStr, password: "password123" });
        login(session);
        router.replace(getLandingRouteForRoles([session.user.role]));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Login failed");
        setSubmitting(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-[#000b18] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#001F3F]/30 blur-[120px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white dark:bg-[#00162a] rounded-[32px] overflow-hidden shadow-2xl p-8 md:p-12 relative z-10 border border-slate-100 dark:border-white/5"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-[#001F3F] rounded-2xl flex items-center justify-center mb-4 shadow-xl">
            <Hexagon className="w-8 h-8 text-teal-400 fill-teal-400/20" />
          </div>
          <h2 className="text-2xl font-black text-[#001F3F] dark:text-white tracking-tight uppercase">Command Center</h2>
          <p className="text-slate-500 font-medium text-sm">Enterprise Management Identity</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="identity@company.com"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 text-slate-900 dark:text-white font-bold focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Access Token</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-6 text-slate-900 dark:text-white font-bold focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 outline-none transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest"
            >
              {error}
            </motion.div>
          )}

          <button
            disabled={submitting}
            className="w-full py-4 bg-[#001F3F] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-[#001F3F]/20 hover:bg-[#002d5c] active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {submitting ? "Authenticating..." : "Authorize Access"}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-6">Quick Switch Identity</p>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_USERS.map((user) => (
              <button
                key={user.email}
                onClick={() => handleQuickLogin(user.email)}
                className="text-left p-2.5 rounded-xl border border-slate-100 dark:border-white/5 hover:border-teal-500 hover:bg-slate-50 dark:hover:bg-white/5 transition-all group"
              >
                <p className="text-[10px] font-black text-[#001F3F] dark:text-teal-400 uppercase mb-0.5 truncate">{user.label}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 truncate">{user.scope}</span>
                  <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-teal-500 transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
