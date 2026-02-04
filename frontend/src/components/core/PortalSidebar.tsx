"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";

const LINKS = [
  { href: "/ceo/dashboard", label: "Overall Dashboard" },
  { href: "/procurement/dashboard", label: "Procurement" },
  { href: "/inventory/dashboard", label: "Inventory" },
  { href: "/finance/dashboard", label: "Finance" },
  { href: "/department/dashboard", label: "Department Head" },
];

const ADMIN_LINKS = [{ href: "/admin/users", label: "Users & Access" }];

export function PortalSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { state, logout } = useAuth();

  const canSeeAdmin = state.roles.includes("CEO");

  return (
    <aside className="sticky top-16 block h-auto w-full shrink-0 overflow-y-auto border-b border-zinc-200 bg-white lg:h-[calc(100vh-4rem)] lg:w-64 lg:border-b-0 lg:border-r">
      <div className="px-4 py-4">
        <div className="text-xs font-semibold tracking-wide text-zinc-500">NAVIGATION</div>
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

        {canSeeAdmin ? (
          <>
            <div className="mt-6 text-xs font-semibold tracking-wide text-zinc-500">ADMINISTRATION</div>
            <nav className="mt-3 space-y-1">
              {ADMIN_LINKS.map((l) => {
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
          </>
        ) : null}

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
