"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, token, _hasHydrated, setAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!token) {
      router.push("/login");
      return;
    }
    
    // Refresh user data silently to update quota/etc
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setAuth(data.user, token);
        }
      })
      .catch(() => {});
  }, [token, _hasHydrated, router, setAuth]);

  if (!_hasHydrated || !token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
