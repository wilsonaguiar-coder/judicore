"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Scale, LogOut, Search, Settings } from "lucide-react";
import type { User } from "@/types";

export function Sidebar({ user }: { user: User | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push("/");
  }

  function navItem(label: string, icon: React.ReactNode, path: string) {
    const active = pathname === path || (path !== "/dashboard" && pathname.startsWith(path));
    return (
      <button
        onClick={() => router.push(path)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? "bg-violet-600/15 text-violet-300 border border-violet-500/20"
            : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <aside className="w-56 border-r border-white/[0.06] flex flex-col bg-[#08080f]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-violet-600/15 border border-violet-500/25 flex items-center justify-center flex-shrink-0">
            <Scale size={13} className="text-violet-400" />
          </div>
          <span className="font-semibold text-sm text-white tracking-tight">Judicore</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItem("Pesquisa", <Search size={15} />, "/dashboard")}
        {user?.role === "ADMIN" &&
          navItem("Indexação", <Settings size={15} />, "/dashboard/admin")}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-white/[0.06]">
        <div className="px-2 mb-3">
          <p className="text-xs font-medium text-white/70 truncate">{user?.name}</p>
          <p className="text-[11px] text-white/30 truncate mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-white/35 hover:text-white/70 hover:bg-white/5 transition-colors border border-transparent"
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
