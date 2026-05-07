import * as cheerio from "cheerio";

const YEAR_RANGES: [number, number][] = [
  [1999, 2002], [2003, 2006], [2007, 2010],
  [2011, 2014], [2015, 2018], [2019, 2022], [2023, 2026],
];

const ALIASES: Record<string, string> = {
  "constituição federal": "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  "cf/88":               "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  "cf":                  "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm",
  "cpc":                 "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
  "código de processo civil": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm",
  "código civil":        "https://www.planalto.gov.br/ccivil_03/_ato1999-2002/2002/lei/l10406.htm",
  "cc":                  "https://www.planalto.gov.br/ccivil_03/_ato1999-2002/2002/lei/l10406.htm",
  "clt":                 "https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452.htm",
  "cdc":                 "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm",
  "código de defesa do consumidor": "https://www.planalto.gov.br/ccivil_03/leis/l8078.htm",
  "ctn":                 "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
  "código tributário nacional": "https://www.planalto.gov.br/ccivil_03/leis/l5172compilado.htm",
  "código penal":        "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
  "cp":                  "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm",
  "código de processo penal": "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
  "cpp":                 "https://www.planalto.gov.br/ccivil_03/decreto-lei/del3689compilado.htm",
  // Previdência social
  "lei 8.213":           "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
  "lei 8213":            "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
  "lei de benefícios":   "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
  "lei 8.212":           "https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm",
  "lei 8212":            "https://www.planalto.gov.br/ccivil_03/leis/l8212cons.htm",
  "loas":                "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
  "lei 8.742":           "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
  "lei orgânica da assistência social": "https://www.planalto.gov.br/ccivil_03/leis/l8742.htm",
  "inss":                "https://www.planalto.gov.br/ccivil_03/leis/l8213cons.htm",
};

export function extractLawRefs(text: string): string[] {
  const refs = new Set<string>();

  for (const m of text.matchAll(/Lei\s+(?:n[oº°]?\s*\.?\s*)?([\d.]+)\/(\d{4})/gi))
    refs.add(`Lei ${m[1]}/${m[2]}`);

  for (const m of text.matchAll(/Decreto-Lei\s+(?:n[oº°]?\s*\.?\s*)?([\d.]+)\/(\d{4})/gi))
    refs.add(`Decreto-Lei ${m[1]}/${m[2]}`);

  for (const m of text.matchAll(/Lei\s+Complementar\s+(?:n[oº°]?\s*\.?\s*)?([\d]+)\/(\d{4})/gi))
    refs.add(`Lei Complementar ${m[1]}/${m[2]}`);

  const abbrevs = ["CPC", "CLT", "CDC", "CTN", "CF", "CF/88", "LOAS"];
  for (const a of abbrevs)
    if (new RegExp(`\\b${a}\\b`, "i").test(text)) refs.add(a);

  // Detecta matéria previdenciária para buscar Lei 8.213 automaticamente
  if (/\bINSS\b|\bprevidên|\bbenefit|\baposentadoria\b|\bpensão\b|\bbenefício\b/i.test(text))
    refs.add("Lei 8.213");

  return [...refs];
}

function buildUrls(ref: string): string[] {
  const lower = ref.toLowerCase().trim();

  for (const [alias, url] of Object.entries(ALIASES))
    if (lower === alias || lower.includes(alias)) return [url];

  const leiMatch = ref.match(/Lei\s+(?:n[oº°]?\s*\.?\s*)?([\d.]+)\/(\d{4})/i);
  if (leiMatch && leiMatch[1] && leiMatch[2]) {
    return buildLeiUrls(leiMatch[1].replace(/\./g, ""), parseInt(leiMatch[2]));
  }

  const dlMatch = ref.match(/Decreto-Lei\s+(?:n[oº°]?\s*\.?\s*)?([\d.]+)\/(\d{4})/i);
  if (dlMatch && dlMatch[1]) {
    return [`https://www.planalto.gov.br/ccivil_03/decreto-lei/del${dlMatch[1].replace(/\./g, "")}.htm`];
  }

  const lcMatch = ref.match(/Lei\s+Complementar\s+(?:n[oº°]?\s*\.?\s*)?([\d]+)\/(\d{4})/i);
  if (lcMatch && lcMatch[1] && lcMatch[2]) {
    return buildLcUrls(lcMatch[1].replace(/\./g, ""), parseInt(lcMatch[2]));
  }

  return [];
}

function buildLeiUrls(num: string, year: number): string[] {
  if (year < 2003) return [`https://www.planalto.gov.br/ccivil_03/leis/l${num}.htm`];
  for (const [y1, y2] of YEAR_RANGES) {
    if (year >= y1 && year <= y2) {
      return [
        `https://www.planalto.gov.br/ccivil_03/_ato${y1}-${y2}/${year}/lei/l${num}.htm`,
        `https://www.planalto.gov.br/ccivil_03/_ato${y1}-${y2}/${year}/lei/L${num}.htm`,
      ];
    }
  }
  return [`https://www.planalto.gov.br/ccivil_03/leis/l${num}.htm`];
}

function buildLcUrls(num: string, year: number): string[] {
  if (year < 2003) return [`https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp${num}.htm`];
  for (const [y1, y2] of YEAR_RANGES) {
    if (year >= y1 && year <= y2)
      return [`https://www.planalto.gov.br/ccivil_03/_ato${y1}-${y2}/${year}/lei/lcp${num}.htm`];
  }
  return [`https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp${num}.htm`];
}

async function fetchLawText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Judicore/1.0)" },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, header, footer").remove();

    const text = $("body")
      .text()
      .replace(/\s{3,}/g, "\n\n")
      .replace(/\t/g, " ")
      .trim();

    if (text.length < 200) return null;
    return text.length > 8000 ? text.slice(0, 8000) + "\n[... texto truncado]" : text;
  } catch {
    return null;
  }
}

export async function fetchLegislation(refs: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const unique = [...new Set(refs)].slice(0, 8);

  await Promise.all(
    unique.map(async (ref) => {
      const urls = buildUrls(ref);
      for (const url of urls) {
        const text = await fetchLawText(url);
        if (text) { result[ref] = text; break; }
      }
      if (!result[ref])
        console.log(`[legislation] Não encontrado no Planalto: ${ref}`);
    })
  );

  return result;
}
