"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { user, token } = await api.post<{ user: any; token: string }>("/auth/login", { email, password });
      setAuth(user, token);
      router.push("/dashboard");
    } catch {
      setError("E-mail ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#030014] text-white flex flex-col items-center justify-center px-4 relative overflow-hidden">

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <motion.div 
          animate={{ 
            x: [0, 80, -80, 0],
            y: [0, -80, 80, 0],
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.6, 0.4] 
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-48 -left-48 w-[600px] h-[600px] rounded-full bg-indigo-500/30 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 100, 0],
            y: [0, 80, -80, 0],
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.5, 0.3] 
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] -right-48 w-[700px] h-[700px] rounded-full bg-fuchsia-500/25 blur-[120px]" 
        />
        <motion.div 
          animate={{ 
            x: [0, 120, -120, 0],
            y: [0, 60, -60, 0],
            scale: [1, 1.1, 1],
            opacity: [0.4, 0.6, 0.4] 
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-48 left-[20%] w-[800px] h-[800px] rounded-full bg-cyan-500/25 blur-[120px]" 
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)]" />
      </div>

      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-white/35 hover:text-white/70 transition-colors z-10"
      >
        <ArrowLeft size={13} />
        Página principal
      </Link>

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm">

        {/* Form */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-8 backdrop-blur-2xl shadow-2xl hover:border-violet-500/35 transition-all duration-500 hover:neon-border-indigo">

          {/* Logo */}
          <div className="flex justify-center mb-6">
            <Image src="/logo.png" alt="JudiCore" width={120} height={40} className="object-contain" priority />
          </div>

          <div className="text-center mb-7">
            <h1 className="text-xl font-bold text-white leading-tight">
              Bem-vindo de volta
            </h1>
            <p className="text-sm text-white/40 mt-1">
              Acesse sua conta para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.05] text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                placeholder="seu@email.gov.br"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-widest" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.05] text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-violet-600/30 mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Entrando...
                </span>
              ) : (
                "Entrar"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          JudiCore · Suíte de Inteligência Jurídica
        </p>
      </div>
    </div>
  );
}
