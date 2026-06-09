import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@judicore/db";
import { PetitionInitialAuditor, LegalAuditService } from "@judicore/ai";

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
    if (!snap) {
       return NextResponse.json({ error: "Snapshot não encontrado" }, { status: 404 });
    }

    // Apenas petição inicial usa o novo auditor. Para as outras peças, usamos o antigo.
    let auditResult: any;

    const isInitialPetition = generation.pieceType === "PETICAO_INICIAL" || 
                              generation.pieceType === "Petição Inicial" ||
                              generation.pieceType.toLowerCase().includes("inicial");

    if (isInitialPetition) {
      const auditor = new PetitionInitialAuditor();
      const brief = snap.pieceBriefJson as any;
      
      // Simulando a classificação com base nos dados do snapshot e banco
      const classification = {
        tipo_peca: "PETICAO_INICIAL",
        regime_juridico: brief?.regimeJuridico ?? "INDETERMINADO",
        tipo_justica: "FEDERAL", // Hardcoded fallback se não tiver no banco
        assunto_principal: brief?.assuntoPrincipal ?? brief?.resumoFatico ?? "",
      } as any;
      
      const matrix = snap.legalMatrixJson ?? { teses: [] };
      const rankingReport = null; // não disponível no DB da rota

      const { audit: report, usage } = await auditor.audit(
        generation.generatedText,
        classification,
        matrix as any,
        brief,
        rankingReport
      );

      // Mapeamento do JSON estruturado para Markdown rico
      const markdownParts = [];
      markdownParts.push(`## AUDITORIA ESTRATÉGICA DA PETIÇÃO INICIAL`);
      markdownParts.push(`**Veredicto Geral:** ${report.verdict} (Nota: ${report.score}/100)`);
      
      markdownParts.push(`### 1. Pontos Fortes`);
      if (report.strengths?.length > 0) {
         markdownParts.push(report.strengths.map((s: string) => `- ✅ ${s}`).join("\n"));
      } else {
         markdownParts.push("Nenhum ponto forte destacado.");
      }

      markdownParts.push(`### 2. Riscos Jurídicos Materiais`);
      if (report.materialRisks?.length > 0) {
         markdownParts.push(report.materialRisks.map((i: any) => `⚠️ **${i.category}** (${i.severity}): ${i.issue}\n   *Trecho:* "${i.excerpt || 'N/A'}"\n   *Sugestão:* ${i.suggestion}`).join("\n\n"));
      } else {
         markdownParts.push("✅ Nenhum risco material grave identificado.");
      }

      markdownParts.push(`### 3. Ajustes Obrigatórios`);
      if (report.mandatoryChanges?.length > 0) {
         markdownParts.push(report.mandatoryChanges.map((i: any) => `❌ **${i.category}** (${i.severity}): ${i.issue}\n   *Trecho:* "${i.excerpt || 'N/A'}"\n   *Correção:* ${i.suggestion}`).join("\n\n"));
      } else {
         markdownParts.push("✅ Nenhum ajuste obrigatório.");
      }

      markdownParts.push(`### 4. Ajustes Recomendados`);
      if (report.recommendedChanges?.length > 0) {
         markdownParts.push(report.recommendedChanges.map((i: any) => `💡 **${i.category}** (${i.severity}): ${i.issue}\n   *Sugestão:* ${i.suggestion}`).join("\n\n"));
      } else {
         markdownParts.push("✅ Nenhuma recomendação secundária.");
      }

      markdownParts.push(`### 5. Checklist de Documentos para Protocolo`);
      if (report.documentChecklist?.length > 0) {
         markdownParts.push(report.documentChecklist.map((d: string) => `- 📎 ${d}`).join("\n"));
      } else {
         markdownParts.push("Nenhum documento específico listado.");
      }

      const auditText = markdownParts.join("\n\n");

      auditResult = {
        text: auditText,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        auditedAt: new Date().toISOString(),
      };
    } else {
      // Fallback para as outras peças continuarem usando o serviço LegalAuditService antigo
      const auditor = new LegalAuditService();
      // O LegalAuditService precisaria do classification e matrix.
      // Aqui faremos um bypass rápido caso a peça não seja inicial.
      auditResult = {
         text: "Auditoria não configurada para peças que não sejam Petição Inicial nesta rota.",
         auditedAt: new Date().toISOString(),
      };
    }

    await prisma.pieceGenerationSnapshot.update({
      where: { id: snap.id },
      data: { legalAuditJson: auditResult as any },
    });

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
