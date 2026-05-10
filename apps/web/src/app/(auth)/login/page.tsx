"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";

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
    <div className="min-h-screen flex items-center justify-center bg-[#07070f] relative overflow-hidden">
      {/* Glow de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-violet-700/10 blur-[140px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-indigo-700/8 blur-[100px]" />
      </div>

      {/* Grid sutil */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Voltar */}
        <div className="mb-10 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            <ArrowLeft size={13} />
            Página principal
          </Link>
        </div>

        {/* Logo + título */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center mb-5">
            <Image src="/logo.png" alt="Judicore" width={144} height={144} className="rounded-xl" />
          </div>
          <h1 className="text-2xl font-semibold text-white leading-tight">
            Bem-vindo de volta
          </h1>
          <p className="text-sm text-white/35 mt-1.5">
            Acesse sua conta para continuar
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-white/40 uppercase tracking-widest" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                placeholder="seu@email.gov.br"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-white/40 uppercase tracking-widest" htmlFor="password">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-white text-sm placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3.5 py-2.5">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium disabled:opacity-50 transition-colors mt-1"
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
          Judicore · Apoio à Decisão Judicial
        </p>
      </div>
    </div>
  );
}
