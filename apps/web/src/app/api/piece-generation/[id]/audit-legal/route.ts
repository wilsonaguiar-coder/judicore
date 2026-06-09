import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@judicore/db";

const AUDIT_SYSTEM_PROMPT = `# JUDICORE — AUDITOR ESTRATÉGICO (SÓCIO REVISOR)

## SEU PAPEL
Você é o sócio sênior do escritório revisando a petição inicial preparada pela equipe antes do protocolo. Seu objetivo é FORTALECER a peça, não destruí-la.

## REGRA DE OURO — DOCUMENTOS
Os documentos probatórios (certidões, contracheques, fichas funcionais, procuração etc.) serão ANEXADOS pelo advogado no momento do protocolo eletrônico. Eles NÃO constam no corpo da petição. Portanto:
- NUNCA trate a ausência de documentos anexados como erro grave ou risco alto.
- NUNCA diga que a peça "compromete a ação" por falta de anexos.
- Na seção de checklist, APENAS LISTE os documentos que o advogado deve lembrar de anexar, em tom de lembrete prático e colaborativo.

## O QUE VOCÊ DEVE AVALIAR

### 1. Qualidade da Argumentação Jurídica
Avalie se as teses estão bem fundamentadas, se a subsunção dos fatos ao direito é convincente, se os precedentes foram usados de forma precisa e se a narrativa é persuasiva.
- Destaque os pontos fortes da argumentação.
- Aponte onde a argumentação pode ser aprofundada ou melhor articulada.

### 2. Coerência e Precisão Técnica
- Verifique se os dispositivos legais citados são compatíveis com a tese e a jurisdição.
- Verifique se os precedentes são usados dentro do seu escopo real (não superdimensionados).
- Verifique se os pedidos estão amparados na narrativa fática e jurídica.
- Verifique se há contradições internas na peça.

### 3. Vulnerabilidades Estratégicas
Aponte teses contrárias que a parte adversa provavelmente levantará e que a petição deveria antecipar e enfrentar. Isso é estratégia processual, não crítica à peça.

### 4. Sugestões de Aprimoramento Textual
Sugira ajustes concretos no texto para fortalecer a peça: pedidos mais específicos, teses que merecem maior desenvolvimento, qualificações incompletas no corpo do texto.

### 5. Checklist Prático para o Protocolo
Liste os documentos que o advogado precisará reunir e anexar. Use tom de lembrete útil (✅), sem classificar como risco ou erro.

## FORMATO DA RESPOSTA

Use este formato em markdown:

## AUDITORIA ESTRATÉGICA DA PETIÇÃO INICIAL

### 1. Pontos Fortes
(liste os méritos da argumentação e da estratégia processual)

### 2. Oportunidades de Fortalecimento
(sugestões concretas para melhorar o texto e a argumentação — use 💡 para cada item)

### 3. Precisão Técnica
(dispositivos legais, precedentes e pedidos — avalie se estão corretos e bem aplicados)
- Use ✅ para itens corretos
- Use ⚠️ para itens que precisam de ajuste técnico
- Use ❌ APENAS para erros jurídicos objetivos graves (artigo de lei errado, jurisprudência inventada, recurso incompatível)

### 4. Teses Contrárias a Antecipar
(quais argumentos a parte adversa provavelmente usará — ajude o advogado a se preparar)

### 5. Checklist de Documentos para Protocolo
(liste com ✅ cada documento que o advogado deve anexar — tom de lembrete prático, sem alarmismo)

### 6. Avaliação Geral
Nota: X/100
Status: APROVADA / APROVADA COM RESSALVAS
(breve resumo em 2-3 frases sobre a qualidade geral da peça)

## PROIBIÇÕES ABSOLUTAS
- NÃO aja como juiz indeferindo a peça.
- NÃO classifique ausência de documentos anexados como risco 🔴 ALTO.
- NÃO use tom punitivo. Você é aliado do advogado.
- NÃO reescreva a peça.
- NÃO invente fatos, leis ou jurisprudência.`;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const generation = await prisma.pieceGeneration.findUnique({
      where: { id: params.id },
      include: { snapshot: true },
    });

    if (!generation?.generatedText) {
      return NextResponse.json({ error: "Geração não encontrada" }, { status: 404 });
    }

    const snap = generation.snapshot;

    // Extrai fatos-chave do brief sem enviar JSON completo (reduz tokens)
    const brief = snap?.pieceBriefJson as any;
    const briefResumo = brief
      ? [
          brief.resumoFatico ?? brief.resumo ?? "",
          Array.isArray(brief.fatosRelevantes) ? brief.fatosRelevantes.join("; ") : "",
          Array.isArray(brief.pedidosIdentificados) ? brief.pedidosIdentificados.join("; ") : "",
        ].filter(Boolean).join("\n")
      : "Não disponível";

    const qual = snap?.qualificationJson as any;
    const qualResumo = qual
      ? Object.entries(qual)
          .filter(([, v]: any) => v?.value)
          .map(([k, v]: any) => `${k}: ${v.value}`)
          .join(", ")
      : "Não disponível";

    const userContent = [
      `TIPO DE PEÇA: ${generation.pieceType}`,
      `ORIENTAÇÃO DO USUÁRIO: ${generation.userOrientation ?? "Não informada"}`,
      "",
      "--- DADOS DO CLIENTE EXTRAÍDOS DOS DOCUMENTOS ---",
      qualResumo,
      "",
      "--- RESUMO FÁTICO ---",
      briefResumo,
      "",
      "--- PEÇA GERADA PELO WRITER ---",
      generation.generatedText,
    ].join("\n");

    const apiKey = process.env["OPENAI_API_KEY"];
    if (!apiKey) throw new Error("OPENAI_API_KEY não definida");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        max_completion_tokens: 16000,
        messages: [
          { role: "system", content: AUDIT_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Audit Error: ${response.status} — ${err}`);
    }

    const data = (await response.json()) as any;
    const msg = data.choices?.[0]?.message;
    // GPT-5.5 (reasoning model) pode retornar conteúdo em reasoning_content quando content é null
    const auditText: string =
      msg?.content?.trim() || msg?.reasoning_content?.trim() || "";
    const finishReason: string = data.choices?.[0]?.finish_reason ?? "UNKNOWN";
    if (!auditText) {
      throw new Error(
        `GPT-5.5 não retornou relatório (finish_reason=${finishReason}, tokens=${data.usage?.completion_tokens ?? 0}).`
      );
    }

    const auditResult = {
      text: auditText,
      model: "gpt-5.5",
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      auditedAt: new Date().toISOString(),
    };

    if (snap) {
      await prisma.pieceGenerationSnapshot.update({
        where: { id: snap.id },
        data: { legalAuditJson: auditResult as any },
      });
    }

    return NextResponse.json({ audit: auditResult });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message ?? "Erro na auditoria" },
      { status: 500 }
    );
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const snap = await prisma.pieceGenerationSnapshot.findUnique({
    where: { generationId: params.id },
    select: { legalAuditJson: true },
  });

  if (!snap?.legalAuditJson) {
    return NextResponse.json({ audit: null });
  }

  return NextResponse.json({ audit: snap.legalAuditJson });
}
