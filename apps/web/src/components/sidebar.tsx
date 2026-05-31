"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { LogOut, Search, Settings, BarChart2 } from "lucide-react";
import Image from "next/image";
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
            ? "bg-primary/10 text-primary font-medium"
            : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <aside className="w-56 border-r border-slate-200 flex flex-col bg-white shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-slate-100">
        <Image src="/logo.png" alt="Judicore" width={112} height={112} className="rounded-lg flex-shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItem("Pesquisa", <Search size={15} />, "/dashboard")}
        {user?.role === "ADMIN" &&
          navItem("Indexação", <Settings size={15} />, "/dashboard/admin")}
        {user?.role === "ADMIN" &&
          navItem("Uso de IA", <BarChart2 size={15} />, "/dashboard/admin/uso")}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-slate-100">
        <div className="px-2 mb-3">
          <p className="text-xs font-medium text-slate-700 truncate">{user?.name}</p>
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
