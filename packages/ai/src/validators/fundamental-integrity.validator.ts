import { FundamentalIntegrityFinding } from "./fundamental-integrity.types.js";
import { TipoPeca } from "../pipeline/types.js";

const CONCLUSIVE_EXPRESSIONS_RE = new RegExp(
  "restou comprovado|" +
  "ficou comprovado|" +
  "restou demonstrado|" +
  "ficou demonstrado|" +
  "é incontroverso|" +
  "consta dos autos|" +
  "a documentação comprova|" +
  "a prova documental demonstra|" +
  "a prova produzida evidencia|" +
  "verifica-se que|" +
  "conclui-se que|" +
  "é evidente que|" +
  "não há dúvida de que|" +
  "todos os requisitos foram preenchidos",
  "gi"
);

const CONCRETE_SUPPORT_RE = new RegExp(
  "\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b|" + // data
  "R\\$\\s*\\d+|" + // valor monetário
  "\\b\\d{7}-\\d{2}\\.\\d{4}\\b|" + // número de processo
  "(?<!\\bart\\.?\\s*|\\bartigo\\s*|\\blei\\s*(?:n[oº]?\\.?\\s*)?|\\binciso\\s*|\\bpar[aá]grafo\\s*)\\b\\d{3,}\\b|" + // números genéricos (>= 3 dígitos) não ligados a leis
  "\\b(?:CNIS|PPP|LTCAT|DER|DIB|DIP|RMI|PBC|NB|CEI|CNPJ|CPF|CTPS|TRCT|GFIP|GPS|RAIS|eSocial|CAT)\\b|" + 
  "\\b(?:laudo|contrato|holerite|extrato|certid[aã]o|carta de indeferimento|processo administrativo|senten[cç]a|ac[oó]rd[aã]o|prova testemunhal|per[ií]cia|protocolo|evento|ID\\s*\\d+|fls\\.?\\s*\\d*|doc\\.?\\s*\\d*|boletim de ocorr[eê]ncia|depoimento|testemunhas?)\\b|" + 
  "\\b(?:prontu[aá]rio|relat[oó]rio m[eé]dico|atestado|exame|decis[aã]o administrativa|carta de concess[aã]o|nota fiscal|comprovante)\\b", 
  "i"
);

const FATAL_CONTEXT_RE = new RegExp(
  "procedência|improcedência|parcial procedência|condenação|absolvição|extinção|homologação|deferimento|indeferimento|" +
  "prescrição|decadência|ilegitimidade|falta de interesse|coisa julgada|carência|qualidade de segurado|incapacidade|" +
  "dano moral|dano material|responsabilidade civil|vínculo empregatício|horas extras|nulidade|prova ilícita|prisão preventiva|tutela de urgência",
  "i"
);

const DESPACHO_DECISION_RE = new RegExp(
  "\\b(?:defiro|indefiro|rejeito|acolho|homologo|extingo|determino bloqueio|determino penhora|revogo|mantenho|concedo|nego)\\b",
  "i"
);

export class FundamentalIntegrityValidator {
  public validate(draft: string, documentType?: string | TipoPeca): FundamentalIntegrityFinding[] {
    const findings: FundamentalIntegrityFinding[] = [];
    
    // Convert to string safely
    const docTypeStr = (documentType || "").toUpperCase();
    
    // Optional for DESPACHO, but we always run it to generate WARNING/FATAL logic
    // We only skip if it's explicitly an unrelated or completely different type, but the prompt says 
    // applies initially to SENTENCA, DECISAO, RECURSO, PETICAO INICIAL, and optional for DESPACHO.
    // The user then expanded to: CONTESTACAO, CUMPRIMENTO_DE_SENTENCA, EMBARGOS, EXCECAO_DE_PRE_EXECUTIVIDADE
    const applicableTypes = [
      "SENTENCA", "DECISAO", "PETICAO_INICIAL", "RECURSO", 
      "CONTESTACAO", "CUMPRIMENTO_DE_SENTENCA", "EMBARGOS", 
      "EXCECAO_DE_PRE_EXECUTIVIDADE", "DESPACHO"
    ];
    
    if (docTypeStr && !applicableTypes.includes(docTypeStr)) {
      return [];
    }

    try {
      const windowSize = 800;
      const totalLength = draft.length;
      
      let match;
      CONCLUSIVE_EXPRESSIONS_RE.lastIndex = 0; // reset
      
      while ((match = CONCLUSIVE_EXPRESSIONS_RE.exec(draft)) !== null) {
        const expression = match[0];
        const matchIndex = match.index;
        
        // Extract previous window
        const startIndex = Math.max(0, matchIndex - windowSize);
        const windowText = draft.substring(startIndex, matchIndex);
        
        // Extract following text for context (e.g. 250 chars) to check fatal terms
        const followingText = draft.substring(matchIndex, Math.min(totalLength, matchIndex + 250));
        
        if (!CONCRETE_SUPPORT_RE.test(windowText)) {
          let severity: "FATAL" | "WARNING" = "WARNING";
          
          // Determine if FATAL based on context
          const isLastThird = matchIndex > (totalLength * 2) / 3;
          const isStrongExpression = expression.toLowerCase() === "todos os requisitos foram preenchidos";
          const hasFatalTerm = FATAL_CONTEXT_RE.test(windowText) || FATAL_CONTEXT_RE.test(followingText);
          
          if (isLastThird || isStrongExpression || hasFatalTerm) {
            severity = "FATAL";
          }
          
          // Special rules for DESPACHO
          if (docTypeStr === "DESPACHO") {
            const hasDecisionLoad = DESPACHO_DECISION_RE.test(draft);
            if (!hasDecisionLoad) {
              // Never FATAL if it's a generic despacho without decision load
              severity = "WARNING";
            }
          }
          
          // Extract an excerpt for reporting
          const excerptStart = Math.max(0, matchIndex - 60);
          const excerptEnd = Math.min(totalLength, matchIndex + 60);
          const excerpt = "..." + draft.substring(excerptStart, excerptEnd).replace(/\s+/g, " ") + "...";
          
          findings.push({
            code: "UNSUPPORTED_CONCLUSIVE_STATEMENT",
            severity,
            expression,
            excerpt,
            reason: `Expressão conclusiva "${expression}" encontrada sem suporte factual ou documental concreto nos ${windowSize} caracteres anteriores.`,
            suggestedFix: "Adicione referências concretas (datas, números, IDs, nomes de documentos, laudos, contratos, etc.) antes de concluir."
          });
        }
      }
    } catch (e) {
      // Fallback: never silently approve if an internal error occurs
      findings.push({
        code: "FUNDAMENTAL_INTEGRITY_INTERNAL_ERROR",
        severity: "WARNING",
        expression: "N/A",
        excerpt: "N/A",
        reason: `Erro interno ao processar a validação de integridade fundamental: ${e instanceof Error ? e.message : String(e)}`,
        suggestedFix: "Verifique os logs internos ou o formato do texto gerado."
      });
    }

    return findings;
  }
}
