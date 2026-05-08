import type { LegalArea } from "../types.js";

export function classifyFromText(text: string): LegalArea {
  const t = text.toLowerCase();

  if (/tribut|fiscal|imposto|icms|iss\b|ipi\b|iof\b|iptu|ipva|pis\b|cofins|csll|irpj|irpf|\btaxa\b|execu.{1,5}fiscal|cr.dito tribut/.test(t)) return "TRIBUTARIO";
  if (/previd.n|aposentadori|inss|benef.cio previd|pens.o por morte|aux.lio.doen|incapacidade|invalide|segurado especial|acidente.*trabalho|bpc\b|loas\b/.test(t)) return "PREVIDENCIARIO";
  if (/trabalhist|v.nculo empregat|horas extras|sal.rio|rescis.o|fgts|clt\b|sindicato|insalubrid|periculosid|jornada|intervalo intrajornada|equipara..o salarial/.test(t)) return "TRABALHISTA";
  if (/\bpenal\b|crime|delito|\bréu\b|pris.o|habeas corpus|tr.fico|roubo|furto|homic.dio|esteli|corrup..o|peculato|lavagem|execu..o penal|liberdade condicional/.test(t)) return "CRIMINAL";
  if (/administrativo|licita..o|contrato admin|servidor p.blico|concurso p.blico|improbidade|desapropria..o|responsabilidade.*estado|concess.o|regula..o/.test(t)) return "ADMINISTRATIVO";
  if (/ambiental|meio ambiente|polui..o|desmatamento|licen.a ambiental|.rea de prote..o|reserva legal|dano ambiental/.test(t)) return "AMBIENTAL";
  if (/\bcivil\b|fam.lia|div.rcio|alimentos|guarda|invent.rio|heran.a|responsabilidade civil|dano moral|loca..o|usucapi.o|ado..o|uni.o est.vel/.test(t)) return "CIVIL";

  return "OUTRO";
}
