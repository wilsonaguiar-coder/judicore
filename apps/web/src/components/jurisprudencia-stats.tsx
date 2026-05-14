"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Stats {
  stf_stj: number;
  tst_trfs: number;
  tj_trts: number;
  total: number;
}

export function JurisprudenciaStats({ token }: { token: string }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<Stats>("/search/stats", token).then(setStats).catch(() => {});
  }, [token]);

  if (!stats) return null;

  const fmt = (n: number) => n.toLocaleString("pt-BR");

  return (
    <div className="border-b bg-muted/30 px-6 py-3">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Nossos Números de Acórdãos Indexados
      </p>
      <div className="flex items-end gap-6 flex-wrap">
        <StatItem label="STF e STJ" value={fmt(stats.stf_stj)} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="TST e TRFs" value={fmt(stats.tst_trfs)} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="TJs e TRTs" value={fmt(stats.tj_trts)} />
        <div className="w-px h-8 bg-border" />
        <StatItem label="Total geral" value={fmt(stats.total)} highlight />
      </div>
    </div>
  );
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
      <p
        className={`text-lg font-bold leading-none tabular-nums ${
          highlight ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
