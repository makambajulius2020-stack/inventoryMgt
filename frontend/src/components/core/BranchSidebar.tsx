"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const LINKS = [
  { href: "/branch/dashboard", label: "Dashboard" },
  { href: "/branch/inventory", label: "Inventory" },
  { href: "/branch/petty-cash", label: "Petty Cash" },
  { href: "/branch/grns", label: "GRNs" },
  { href: "/branch/invoices", label: "Invoices & AP" },
  { href: "/branch/reports", label: "Reports" },
];

export function BranchSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <aside className="sticky top-0 block h-auto w-full shrink-0 overflow-y-auto border-b border-zinc-200 bg-white lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-4 py-4">
        <div className="text-xs font-semibold tracking-wide text-zinc-500">BRANCH PORTAL</div>
        <nav className="mt-3 space-y-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`block rounded-lg px-3 py-2 text-sm ${
                  active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-50"
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
          className="mt-6 block w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
