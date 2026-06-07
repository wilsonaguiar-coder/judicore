import fs from "fs/promises";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const CORPUS_DIR = path.resolve(process.cwd(), ".real-corpus");
const OUTPUT_FILE = path.join(CORPUS_DIR, "OPENAI_AVAILABLE_MODELS.md");

async function run() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não definida no .env");
  }

  console.log("Buscando modelos disponíveis...");
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Falha na requisição: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const models = data.data as any[];

  // Filter out completely irrelevant models (dall-e, whisper, tts, embedding)
  const textModels = models.filter(m => 
    m.id.includes("gpt") || m.id.includes("o1") || m.id.includes("o3")
  );

  // Sort alphabetically
  textModels.sort((a, b) => a.id.localeCompare(b.id));

  let md = `# OpenAI Available Models\n\n`;
  md += `Total de modelos de texto detectados: ${textModels.length}\n\n`;
  md += `| Model ID | Owner | Created |\n`;
  md += `|---|---|---|\n`;

  for (const m of textModels) {
    const date = new Date(m.created * 1000).toISOString().split('T')[0];
    md += `| \`${m.id}\` | ${m.owned_by} | ${date} |\n`;
  }

  // Identificar categorias
  const advanced = textModels.filter(m => m.id.includes("gpt-4o") || m.id.includes("gpt-5")).map(m => m.id);
  const reasoning = textModels.filter(m => m.id.includes("o1") || m.id.includes("o3")).map(m => m.id);
  const economy = textModels.filter(m => m.id.includes("mini") || m.id.includes("gpt-3.5")).map(m => m.id);

  md += `\n## Análise Inicial\n`;
  md += `- **Modelos Mais Avançados (Flagships):** ${advanced.join(", ") || "Nenhum detectado"}\n`;
  md += `- **Modelos de Reasoning:** ${reasoning.join(", ") || "Nenhum detectado"}\n`;
  md += `- **Modelos Econômicos:** ${economy.join(", ") || "Nenhum detectado"}\n`;

  await fs.writeFile(OUTPUT_FILE, md);
  console.log("Arquivo gerado:", OUTPUT_FILE);
}

run().catch(console.error);
