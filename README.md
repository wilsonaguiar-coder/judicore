# Judicore — Sistema de Apoio à Decisão Judicial

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Monorepo | pnpm workspaces + Turborepo |
| API | Fastify + TypeScript |
| Frontend | Next.js 14 + Tailwind + shadcn/ui |
| Banco relacional | PostgreSQL (Prisma ORM) |
| Busca | Elasticsearch 8 (analyzer português) |
| Cache | Redis |
| IA | Claude (Anthropic) — contexto fechado |

## Pré-requisitos

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose

## Setup

```bash
# 1. Subir infraestrutura
cd infra
docker compose up -d

# 2. Instalar dependências
cd ..
pnpm install

# 3. Configurar variáveis de ambiente
cp infra/.env.example apps/api/.env
# Editar apps/api/.env com sua ANTHROPIC_API_KEY

# 4. Rodar migrations do banco
pnpm db:migrate

# 5. Gerar cliente Prisma
pnpm db:generate

# 6. Iniciar em modo dev
pnpm dev
```

## Estrutura

```
judicore/
├── apps/
│   ├── api/          API Fastify (porta 3001)
│   └── web/          Frontend Next.js (porta 3000)
├── packages/
│   ├── db/           Prisma + schema
│   ├── search/       Cliente Elasticsearch + RAG retrieval
│   └── ai/           Claude + geração de documentos
└── infra/
    └── docker-compose.yml
```

## Fluxo principal

1. Usuário descreve o caso
2. Backend busca no Elasticsearch (sem IA)
3. Jurisprudências reais são retornadas
4. Usuário seleciona as decisões relevantes
5. IA gera despacho/decisão/sentença **apenas com base no contexto selecionado**

## Regras anti-alucinação

A IA opera com system prompt fixo que proíbe:
- Citar número de processo não presente no contexto
- Mencionar tribunal não presente no contexto
- Inventar datas, ementas ou relatores
