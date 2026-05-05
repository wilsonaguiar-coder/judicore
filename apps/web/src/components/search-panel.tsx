"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Search, Loader2 } from "lucide-react";
import { LEGAL_AREAS } from "@/types";
import type { Jurisprudencia, LegalArea } from "@/types";

interface Props {
  caseId: string;
  token: string;
  defaultArea?: LegalArea;
  onResults: (results: Jurisprudencia[]) => void;
}

const TRIBUNAIS = ["STJ", "STF", "TRF1", "TRF2", "TRF3", "TRF4", "TRF5", "TRF6"];

export function SearchPanel({ caseId, token, defaultArea, onResults }: Props) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<LegalArea | "">(defaultArea ?? "");
  const [tribunais, setTribunais] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const result = await api.post<{ hits: Jurisprudencia[]; total: number }>(
        "/search",
        { query, caseId, area: area || undefined, tribunais: tribunais.length ? tribunais : undefined },
        token
      );
      onResults(result.hits);
      setSearched(true);
    } finally {
      setLoading(false);
    }
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
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Descreva o tema jurídico..."
              className="w-full pl-8 pr-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
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

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tribunais</h3>
        <div className="flex flex-wrap gap-1.5">
          {TRIBUNAIS.map((t) => (
            <button
              key={t}
              onClick={() => toggleTribunal(t)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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

      {searched && (
        <p className="text-xs text-muted-foreground">
          Selecione as decisões relevantes no painel central antes de gerar o documento.
        </p>
      )}
    </div>
  );
}
