"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Lock, Mail, ChevronRight } from "lucide-react";

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
  { email: "controller.pb@company.com", label: "Store Controller", scope: "Patiobela" },
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
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[var(--accent)]/20 blur-[140px] rounded-full" />

      <div className="w-full max-w-md glass rounded-[32px] overflow-hidden shadow-2xl p-8 md:p-12 relative z-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-[#001F3F] rounded-2xl flex items-center justify-center mb-4 shadow-xl overflow-hidden">
            <Image src="/Hugamara-Logo.jpeg" alt="HUGAMARA" width={64} height={64} className="w-full h-full object-cover" priority />
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight uppercase">HUGAMARA</h2>
          <p className="text-[var(--text-secondary)] font-medium text-sm">Enterprise Management System</p>
        </div>

        <form className="space-y-6" onSubmit={onSubmit}>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Secure Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="identity@company.com"
                className="w-full bg-[var(--input)] border border-[var(--input-border)] rounded-2xl py-4 pl-12 pr-6 text-[var(--text-primary)] font-bold focus:border-[var(--input-focus)] focus:ring-4 focus:ring-[var(--ring)]/15 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest ml-1">Access Token</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[var(--input)] border border-[var(--input-border)] rounded-2xl py-4 pl-12 pr-6 text-[var(--text-primary)] font-bold focus:border-[var(--input-focus)] focus:ring-4 focus:ring-[var(--ring)]/15 outline-none transition-all"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-black uppercase tracking-widest animate-in fade-in slide-in-from-left-2 duration-200">
              {error}
            </div>
          )}

          <button
            disabled={submitting}
            className="w-full py-4 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-black/30 hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
          >
            {submitting ? "Authenticating..." : "Authorize Access"}
          </button>
        </form>

        <div className="mt-10 pt-8 border-t border-white/10">
          <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest text-center mb-6">Quick Switch Identity</p>
          <div className="grid grid-cols-2 gap-3">
            {MOCK_USERS.map((user) => (
              <button
                key={user.email}
                onClick={() => handleQuickLogin(user.email)}
                className="text-left p-2.5 rounded-xl border border-white/10 hover:border-[var(--accent-hover)] hover:bg-white/5 transition-all group"
              >
                <p className="text-[10px] font-black text-[var(--accent-hover)] uppercase mb-0.5 truncate">{user.label}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] truncate">{user.scope}</span>
                  <ChevronRight className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[var(--accent-hover)] transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
