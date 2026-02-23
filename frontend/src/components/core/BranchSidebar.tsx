"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";

import { useAuth } from "@/contexts/AuthContext";
import { BRANDING } from "@/lib/branding";

const LINKS = [
  { href: "/gm/dashboard", label: "Dashboard" },
  { href: "/gm/inventory", label: "Inventory" },
  { href: "/gm/finance", label: "Finance" },
];

export function BranchSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();

  const assignedBranchLabel = state.allowedLocations?.[0] ?? "—";
  const branch = Object.values(BRANDING.branches).find((b) => b.name === assignedBranchLabel);

  return (
    <aside className="sticky top-0 block h-auto w-full shrink-0 overflow-y-auto border-b border-white/10 bg-[#001F3F]/90 backdrop-blur-xl lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div className="px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-white/5">
            <Image src={branch?.logo ?? "/Hugamara-Logo.jpeg"} alt={branch?.name ?? "Branch"} width={48} height={48} className="w-full h-full object-cover" priority />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black tracking-widest text-teal-300 uppercase">GM Portal</div>
            <div className="mt-1 text-base font-black text-white truncate">{assignedBranchLabel}</div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <div className="text-[10px] font-black tracking-widest text-slate-200/80 uppercase">Assigned Location</div>
          <div className="mt-1 text-sm font-bold text-white truncate">{assignedBranchLabel}</div>
        </div>

        <nav className="mt-3 space-y-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-2xl px-4 py-3 text-sm font-bold transition-all ${
                  active ? "bg-white/10 text-white" : "text-slate-200/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="mt-6 block w-full rounded-2xl px-4 py-3 text-left text-sm font-bold text-slate-200/80 hover:bg-white/5 hover:text-white transition-all"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
