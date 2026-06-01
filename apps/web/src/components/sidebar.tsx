"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { LogOut, Search, Settings, BarChart2, FlaskConical } from "lucide-react";
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
    const active = pathname === path;
    return (
      <button
        onClick={() => router.push(path)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          active
            ? "bg-white/10 text-white font-medium"
            : "text-slate-400 hover:text-white hover:bg-white/8"
        }`}
      >
        {icon}
        {label}
      </button>
    );
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col bg-[#1a2035]">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/8">
        <Image src="/logo.png" alt="Judicore" width={112} height={112} className="rounded-lg flex-shrink-0" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItem("Pesquisa", <Search size={15} />, "/dashboard")}
        {user?.role === "ADMIN" &&
          navItem("Indexação", <Settings size={15} />, "/dashboard/admin")}
        {user?.role === "ADMIN" &&
          navItem("Uso de IA", <BarChart2 size={15} />, "/dashboard/admin/uso")}
        {user?.role === "ADMIN" &&
          navItem("Testes", <FlaskConical size={15} />, "/dashboard/admin/testes")}
      </nav>

      {/* User / Logout */}
      <div className="px-3 py-4 border-t border-white/8">
        <div className="px-2 mb-3">
          <p className="text-xs font-medium text-slate-300 truncate">{user?.name}</p>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
