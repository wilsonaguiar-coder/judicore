"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { LEGAL_AREAS } from "@/types";
import type { LegalArea } from "@/types";

const SOURCES = ["tst"] as const;
type Source = typeof SOURCES[number];

interface Props {
  token: string;
  onTriggered: () => void;
}

export function TriggerIndexDialog({ token, onTriggered }: Props) {
  const [open, setOpen] = useState(false);
  const [allAreas, setAllAreas] = useState(false);
  const [area, setArea] = useState<LegalArea>("TRIBUTARIO");
  const [sources, setSources] = useState<Source[]>(["tst"]);
  const [maxPages, setMaxPages] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function toggleSource(s: Source) {
    setSources((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  }

  async function handleTrigger() {
    if (sources.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      if (allAreas) {
        const res = await api.post<{ enqueued: number }>(
          "/admin/jobs/trigger-all",
          { sources, maxPages },
          token
        );
        setResult(`${res.enqueued} áreas enfileiradas`);
      } else {
        const res = await api.post<{ jobId: string }>(
          "/admin/jobs/trigger",
          { area, sources, maxPages },
          token
        );
        setResult(`Job enfileirado: #${res.jobId}`);
      }
      onTriggered();
    } catch (e: any) {
      setResult(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); setResult(null); }}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          <Play size={13} />
          Indexar agora
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-background rounded-xl border shadow-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Indexar jurisprudência</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setAllAreas((v) => !v)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md border text-sm transition-colors ${
                allAreas
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="font-medium">Todas as áreas</span>
              <span className="text-xs opacity-70">7 áreas de uma vez</span>
            </button>

            {!allAreas && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Área</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value as LegalArea)}
                  className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {(Object.entries(LEGAL_AREAS) as [LegalArea, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fontes</label>
              <div className="flex gap-2">
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSource(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      sources.includes(s)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Páginas por fonte
                </label>
                <div className="flex gap-1">
                  <button onClick={() => setMaxPages(200)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">200</button>
                  <button onClick={() => setMaxPages(1000)} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground hover:bg-secondary/80">1k</button>
                  <button onClick={() => setMaxPages(5000)} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30">5k</button>
                </div>
              </div>
              <input
                type="number"
                min={1}
                max={10000}
                value={maxPages}
                onChange={(e) => setMaxPages(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {maxPages >= 1000 && (
                <p className="text-[10px] text-muted-foreground">
                  ~{Math.round(maxPages * 20).toLocaleString("pt-BR")} docs · ~{Math.round(maxPages * 1.5 / 60)} min estimados
                </p>
              )}
            </div>

            {result && (
              <p className={`text-xs ${result.startsWith("Erro") ? "text-destructive" : "text-green-600"}`}>
                {result}
              </p>
            )}

            <button
              onClick={handleTrigger}
              disabled={loading || sources.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              {loading ? "Enfileirando..." : "Iniciar indexação"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
