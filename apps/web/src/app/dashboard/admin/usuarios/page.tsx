"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import {
  Loader2, Users, Plus, Pencil, Trash2, X, Check, Shield, AlertCircle,
} from "lucide-react";

type UserRole = "COMUM" | "SERVIDOR" | "ADMIN";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessExpiresAt: string | null;
  createdAt: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  COMUM: "Comum",
  SERVIDOR: "Servidor",
  ADMIN: "Admin",
};

const ROLE_COLORS: Record<UserRole, string> = {
  COMUM: "bg-slate-700 text-slate-300",
  SERVIDOR: "bg-blue-900/60 text-blue-300",
  ADMIN: "bg-violet-900/60 text-violet-300",
};

const EMPTY_FORM = { name: "", email: "", password: "", role: "COMUM" as UserRole, accessExpiresAt: "" };

function fmt(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("pt-BR");
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function UsuariosPage() {
  const { token, user } = useAuthStore();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<AdminUser[]>("/admin/users", token);
      setUsers(data);
    } catch (e: any) {
      setError(e.message ?? "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (user?.role !== "ADMIN") { router.push("/dashboard"); return; }
    void load();
  }, [token, user, router, load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(u: AdminUser) {
    setEditingId(u.id);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      accessExpiresAt: u.accessExpiresAt ? u.accessExpiresAt.slice(0, 10) : "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setFormError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        role: form.role,
        accessExpiresAt: form.accessExpiresAt ? new Date(form.accessExpiresAt).toISOString() : null,
      };
      if (editingId) {
        if (form.password) payload["password"] = form.password;
        await api.patch(`/admin/users/${editingId}`, payload, token);
      } else {
        payload["email"] = form.email;
        payload["password"] = form.password;
        await api.post("/admin/users", payload, token);
      }
      closeForm();
      await load();
    } catch (e: any) {
      setFormError(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/users/${id}`, token);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: any) {
      setError(e.message ?? "Erro ao excluir");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar user={user} />
        <div className="flex-1 flex items-center justify-center bg-[#0f1623]">
          <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0f1623] text-white">
      <Sidebar user={user} />

      <main className="flex-1 overflow-y-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <Users size={17} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">Usuários</h1>
              <p className="text-xs text-slate-500">{users.length} cadastrado{users.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            Novo usuário
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-6 px-4 py-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl border border-white/8 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/[0.02]">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">E-mail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Papel</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Acesso expira</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Criado em</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      {u.role === "ADMIN" && <Shield size={12} className="text-violet-400 shrink-0" />}
                      {u.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role]}`}>
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.accessExpiresAt ? (
                      <span className={isExpired(u.accessExpiresAt) ? "text-red-400" : "text-slate-400"}>
                        {fmt(u.accessExpiresAt)}
                        {isExpired(u.accessExpiresAt) && " (expirado)"}
                      </span>
                    ) : (
                      <span className="text-slate-600">Sem expiração</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmt(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-md hover:bg-white/8 text-slate-400 hover:text-white transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(u.id)}
                        disabled={deletingId === u.id || u.id === user?.id}
                        className="p-1.5 rounded-md hover:bg-red-900/40 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={u.id === user?.id ? "Não é possível excluir o próprio usuário" : "Excluir"}
                      >
                        {deletingId === u.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Trash2 size={13} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 text-sm">
                    Nenhum usuário cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Form panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[#1a2035] border border-white/10 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/8">
              <h2 className="font-semibold">{editingId ? "Editar usuário" : "Novo usuário"}</h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg hover:bg-white/8 text-slate-400 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Nome</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                  placeholder="Nome completo"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500/60 placeholder:text-slate-600"
                />
              </div>

              {!editingId && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                    placeholder="email@dominio.com"
                    className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500/60 placeholder:text-slate-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Senha {editingId && <span className="text-slate-600">(deixe em branco para não alterar)</span>}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required={!editingId}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500/60 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Papel</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500/60"
                >
                  <option value="COMUM">Comum</option>
                  <option value="SERVIDOR">Servidor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Acesso expira em <span className="text-slate-600">(opcional — deixe vazio para acesso permanente)</span>
                </label>
                <input
                  type="date"
                  value={form.accessExpiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, accessExpiresAt: e.target.value }))}
                  className="w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-violet-500/60"
                />
              </div>

              {formError && (
                <p className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle size={12} />
                  {formError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 py-2 rounded-lg text-sm border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 font-medium transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {editingId ? "Salvar" : "Criar usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
