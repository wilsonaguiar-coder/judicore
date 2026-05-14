"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Stats {
  stf_stj: number;
  tst_trfs: number;
  tj_trts: number;
  total: number;
}

export function JurisprudenciaStats({ token, inline }: { token: string; inline?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/search/stats", token).then(setStats).catch(() => {});
  }, [token]);

  const fmt = (n: number) => n.toLocaleString("pt-BR");

  const inner = (
    <>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Nossos Números de Acórdãos Indexados
      </p>
      <div className="flex items-end gap-6 flex-wrap">
        <StatItem label="STF e STJ" value={stats ? fmt(stats.stf_stj) : null} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="TST e TRFs" value={stats ? fmt(stats.tst_trfs) : null} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="TJs e TRTs" value={stats ? fmt(stats.tj_trts) : null} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="Total geral" value={stats ? fmt(stats.total) : null} highlight />
      </div>
    </>
  );

  if (inline) return <>{inner}</>;

  return (
    <div className="border-b bg-muted/30 px-6 py-3">
      {inner}
    </div>
  );
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
      {value === null ? (
        <div className="h-5 w-16 rounded bg-muted animate-pulse mt-0.5" />
      ) : (
        <p className={`text-lg font-bold leading-none tabular-nums ${highlight ? "text-primary" : ""}`}>
          {value}
        </p>
      )}
    </div>
  );
}
