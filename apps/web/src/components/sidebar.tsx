"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { Scale, LogOut, FolderOpen, Settings } from "lucide-react";
import type { User } from "@/types";

export function Sidebar({ user }: { user: User | null }) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <aside className="w-56 border-r flex flex-col bg-background">
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-primary" />
          <span className="font-semibold text-sm">Judicore</span>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <FolderOpen size={15} />
          Casos
        </button>
        {user?.role === "ADMIN" && (
          <button
            onClick={() => router.push("/dashboard/admin")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Settings size={15} />
            Indexação
          </button>
        )}
      </nav>

      <div className="px-4 py-4 border-t">
        <div className="mb-3">
          <p className="text-xs font-medium truncate">{user?.name}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <LogOut size={13} />
          Sair
        </button>
      </div>
    </aside>
  );
}
