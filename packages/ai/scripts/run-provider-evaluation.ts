import * as fs from "fs";
import * as path from "path";
import { ProviderEvaluationService } from "../src/audit/assisted-revision/evaluation/provider-evaluation.service.js";
import { OFFICIAL_EVALUATION_CASES } from "../src/audit/assisted-revision/evaluation/provider-evaluation.types.js";
import { OpenAIRevisionAdapter } from "../src/audit/assisted-revision/providers/openai-revision-adapter.js";
import { GeminiRevisionAdapter } from "../src/audit/assisted-revision/providers/gemini-revision-adapter.js";
import { DeepSeekRevisionAdapter } from "../src/audit/assisted-revision/providers/deepseek-revision-adapter.js";

// Carrega as vari\u00E1veis de ambiente seguras nativamente (sem dependencia externa de dotenv)
const envPath = "/opt/judicore/apps/api/.env";
const localEnvPath = path.resolve(process.cwd(), ".env");

function loadEnv(targetPath: string) {
  if (fs.existsSync(targetPath)) {
    const content = fs.readFileSync(targetPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...rest] = trimmed.split("=");
        if (key && rest.length > 0) {
          const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
          process.env[key.trim()] = value;
        }
      }
    }
  }
}

loadEnv(envPath);
loadEnv(localEnvPath); // Fallback local


async function runBenchmark() {
  console.log("==================================================");
  console.log("INICIANDO PROVIDER EVALUATION HARNESS (BENCHMARK)");
  console.log("==================================================\n");

  const openAiKey = process.env.OPENAI_API_KEY || "";
  const geminiKey = process.env.GEMINI_API_KEY || "";
  const deepseekKey = process.env.DEEPSEEK_API_KEY || "";

  if (!openAiKey || !geminiKey || !deepseekKey) {
    console.warn("[AVISO] Uma ou mais chaves de API n\u00E3o foram encontradas no ambiente.");
    console.warn("Certifique-se de que o arquivo .env cont\u00E9m OPENAI_API_KEY, GEMINI_API_KEY e DEEPSEEK_API_KEY.\n");
  }

  // Instanciar Adapters REAIS
  const adapters: Record<string, any> = {
    "OPENAI": new OpenAIRevisionAdapter(openAiKey),
    "GEMINI": new GeminiRevisionAdapter(geminiKey),
    "DEEPSEEK": new DeepSeekRevisionAdapter(deepseekKey)
  };

  const service = new ProviderEvaluationService(adapters);

  console.log(`Avaliando ${OFFICIAL_EVALUATION_CASES.length} casos em ${Object.keys(adapters).length} provedores...\n`);

  const results = await service.evaluate(OFFICIAL_EVALUATION_CASES);

  console.log("RESULTADOS OBTIDOS:\n");

  for (const res of results) {
    console.log(`\u25B6 Caso: ${res.caseId}`);
    console.log(`  Provider: ${res.provider}`);
    console.log(`  Model: ${res.model}`);
    console.log(`  Tempo: ${res.notes}`);
    console.log(`  Sugest\u00E3o:`);
    console.log(`    ${res.suggestion.replace(/\n/g, "\n    ")}`);
    console.log("--------------------------------------------------");
  }

  console.log("\n==================================================");
  console.log("BENCHMARK FINALIZADO COM SUCESSO");
  console.log("NOTA: NENHUM DRAFT FOI ALTERADO E NENHUM VALIDADOR FOI MODIFICADO.");
  console.log("==================================================");
}

runBenchmark().catch(err => {
  console.error("Erro fatal na execu\u00E7\u00E3o do benchmark:", err);
  process.exit(1);
});
