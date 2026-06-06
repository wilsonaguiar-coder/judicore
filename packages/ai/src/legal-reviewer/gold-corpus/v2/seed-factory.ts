/**
 * FASE 9.0.8.9 — SeedFactory
 *
 * Gera CaseSeedData determinístico a partir do caseId.
 *
 * Regras de design:
 * - Sem Math.random(), sem new Date(), sem I/O externo.
 * - Mesmo caseId sempre produz o mesmo CaseSeedData.
 * - caseIds diferentes produzem dados distintos na maior parte das vezes.
 * - Hash FNV-1a com derivações por salt para cada campo.
 */

import type { CaseSeedData } from "./gold-corpus-v2.types.js";

// ─── Listas fixas ─────────────────────────────────────────────────────────────

const NAMES: readonly string[] = [
  "Maria das Graças Oliveira",
  "João Carlos Mendes",
  "Ana Paula Ferreira",
  "Francisco José Santos",
  "Antônia Pereira Lima",
  "Raimundo Alves Costa",
  "Francisca Rodrigues Silva",
  "José Wilson Nascimento",
  "Luiza Gomes Araújo",
  "Benedito Souza Carvalho",
  "Tereza Cristina Barbosa",
  "Carlos Eduardo Martins",
  "Rosa Maria Cunha",
  "Manoel Antônio Rocha",
  "Aparecida Nunes Batista",
  "Pedro Henrique Cavalcanti",
];

const CITIES: readonly string[] = [
  "São Paulo",
  "Rio de Janeiro",
  "Brasília",
  "Salvador",
  "Fortaleza",
  "Belo Horizonte",
  "Curitiba",
  "Manaus",
  "Recife",
  "Porto Alegre",
  "Goiânia",
  "Belém",
  "Guarulhos",
  "Campinas",
  "São Luís",
];

const COURTS: readonly string[] = [
  "1ª Vara Federal",
  "2ª Vara Federal",
  "3ª Vara Federal",
  "1ª Vara do Trabalho",
  "2ª Vara do Trabalho",
  "1ª Vara de Família",
  "2ª Vara de Família",
  "1ª Vara Cível",
  "2ª Vara Cível",
  "Vara Criminal",
  "Vara da Fazenda Pública",
  "Juizado Especial Cível",
  "1ª Vara Previdenciária",
  "2ª Vara Previdenciária",
  "Vara Tributária Federal",
];

const CAUSE_VALUES: readonly string[] = [
  "R$ 15.000,00",
  "R$ 23.500,00",
  "R$ 47.800,00",
  "R$ 8.900,00",
  "R$ 62.300,00",
  "R$ 112.000,00",
  "R$ 33.700,00",
  "R$ 5.500,00",
  "R$ 89.400,00",
  "R$ 204.600,00",
  "R$ 18.250,00",
  "R$ 41.900,00",
];

const SALARY_VALUES: readonly string[] = [
  "R$ 1.412,00",
  "R$ 2.824,00",
  "R$ 4.236,00",
  "R$ 1.800,00",
  "R$ 3.200,00",
  "R$ 5.600,00",
  "R$ 7.850,00",
  "R$ 2.100,00",
  "R$ 1.656,00",
  "R$ 4.800,00",
];

// ─── Hash ─────────────────────────────────────────────────────────────────────

/** FNV-1a 32-bit — determinístico, sem overflow JavaScript. */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

/** Derivação secundária: aplica FNV-1a sobre a concatenação de base e salt. */
function derive(base: number, salt: string): number {
  return fnv1a(base.toString() + salt);
}

/** Seleciona determinística de um array por módulo. Lança se o array for vazio. */
function pick<T>(arr: readonly T[], n: number): T {
  if (arr.length === 0) throw new Error("pick: array vazio");
  // noUncheckedIndexedAccess: o item pode ser undefined se arr for vazio,
  // mas garantimos que não está acima.
  const item = arr[n % arr.length];
  if (item === undefined) throw new Error("pick: índice fora do range");
  return item;
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

/** CPF mascarado sintético no formato NNN.NNN.NNN-NN. */
function formatCpf(n: number): string {
  const d = n.toString().padStart(11, "0").slice(0, 11);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Número de processo CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO */
function formatProcess(n: number, year: number): string {
  const seq = (n % 9_999_999).toString().padStart(7, "0");
  const dd = ((n % 98) + 1).toString().padStart(2, "0");
  const j = (n % 9) + 1;
  const tt = ((n % 99) + 1).toString().padStart(2, "0");
  const oooo = ((n % 9999) + 1).toString().padStart(4, "0");
  return `${seq}-${dd}.${year}.${j}.${tt}.${oooo}`;
}

/** Data no formato DD/MM/AAAA a partir de valores numéricos derivados. */
function formatDate(dayN: number, monthN: number, year: number): string {
  const d = ((dayN % 28) + 1).toString().padStart(2, "0");
  const m = ((monthN % 12) + 1).toString().padStart(2, "0");
  return `${d}/${m}/${year}`;
}

// ─── SeedFactory ──────────────────────────────────────────────────────────────

export class SeedFactory {
  static build(caseId: string): CaseSeedData {
    const h0 = fnv1a(caseId);

    const hName   = derive(h0, "name");
    const hCity   = derive(h0, "city");
    const hCourt  = derive(h0, "court");
    const hCause  = derive(h0, "cause");
    const hSalary = derive(h0, "salary");
    const hCpf    = derive(h0, "cpf");
    const hProto  = derive(h0, "proto");
    const hProc   = derive(h0, "proc");
    const hBirth  = derive(h0, "birth");
    const hBase   = derive(h0, "base");
    const hDer    = derive(h0, "der");

    const birthYear = 1945 + (hBirth % 40); // 1945–1984
    const baseYear  = 2015 + (hBase % 9);   // 2015–2023
    const derYear   = baseYear + (hDer % 3); // baseYear + 0–2

    return {
      personName:    pick(NAMES, hName),
      cpf:           formatCpf(hCpf),
      birthDate:     formatDate(hBirth, hBirth >>> 8, birthYear),
      baseDate:      formatDate(hBase, hBase >>> 4, baseYear),
      derDate:       formatDate(hDer, hDer >>> 4, derYear),
      protocolNumber: `${(hProto % 999_999_999).toString().padStart(9, "0")}/2024`,
      processNumber: formatProcess(hProc, baseYear),
      causeValue:    pick(CAUSE_VALUES, hCause),
      salaryBase:    pick(SALARY_VALUES, hSalary),
      city:          pick(CITIES, hCity),
      courtName:     pick(COURTS, hCourt),
    };
  }
}
