"use client";

import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { Search, Loader2 } from "lucide-react";
import { LEGAL_AREAS } from "@/types";
import type { Jurisprudencia, LegalArea } from "@/types";

interface Props {
  caseId: string;
  token: string;
  defaultArea?: LegalArea | undefined;
  defaultQuery?: string | undefined;
  onResults: (results: Jurisprudencia[]) => void;
}

const TRIBUNAL_GROUPS = [
  { label: "Superiores", tribunais: ["STF","STJ","TST"] },
  { label: "Federais",   tribunais: ["TRF1","TRF2","TRF3","TRF4","TRF5","TRF6"] },
];

export function SearchPanel({ caseId, token, defaultArea, defaultQuery, onResults }: Props) {
  const [query, setQuery] = useState(defaultQuery ?? "");
  const [area, setArea] = useState<LegalArea | "">(defaultArea ?? "");
  const [tribunais, setTribunais] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const autoSearched = useRef(false);

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await api.post<{ hits: Jurisprudencia[]; total: number }>(
        "/search",
        { query: q, caseId, area: area || undefined, tribunais: tribunais.length ? tribunais : undefined },
        token
      );
      onResults(result.hits ?? []);
    } catch {
      setError("Erro ao buscar. Tente novamente.");
      onResults([]);
    } finally {
      setLoading(false);
    }
  }

  // Auto-busca quando o caso carrega com descrição
  useEffect(() => {
    if (defaultQuery && !autoSearched.current) {
      autoSearched.current = true;
      setQuery(defaultQuery);
      runSearch(defaultQuery);
    }
  }, [defaultQuery]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query);
  }

  function toggleTribunal(t: string) {
    setTribunais((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  return (
    <div className="p-4 space-y-5">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Busca</h2>
        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descreva o tema jurídico..."
              rows={3}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <select
            value={area}
            onChange={(e) => setArea(e.target.value as LegalArea)}
            className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas as áreas</option>
            {(Object.entries(LEGAL_AREAS) as [LegalArea, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tribunais</h3>
          <button
            onClick={() => setTribunais([])}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              tribunais.length === 0
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
        </div>

        {TRIBUNAL_GROUPS.map((group) => {
          const allSelected = group.tribunais.every((t) => tribunais.includes(t));
          function toggleGroup() {
            if (allSelected) {
              setTribunais((prev) => prev.filter((t) => !group.tribunais.includes(t)));
            } else {
              setTribunais((prev) => [...new Set([...prev, ...group.tribunais])]);
            }
          }
          return (
            <div key={group.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{group.label}</span>
                <button
                  onClick={toggleGroup}
                  className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                    allSelected
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {allSelected ? "desmarcar" : "todos"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {group.tribunais.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggleTribunal(t)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      tribunais.includes(t)
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Selecione as decisões relevantes no painel central para gerar o documento.
      </p>
    </div>
  );
}
