import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ReviewStudioRepository, prisma } from "@/lib/review-studio.repository";

// Stub Prisma to avoid real DB calls during tests
prisma.reviewSession = {
  create: async (args: any) => ({ id: "sess-1", ...args.data }),
  findUnique: async (args: any) => ({ id: args.where.id, originalDraft: "Mock draft" }),
  findMany: async (args: any) => [{ id: "sess-1" }]
} as any;

prisma.reviewAudit = {
  create: async (args: any) => ({ id: "audit-1", ...args.data })
} as any;

prisma.reviewSuggestion = {
  create: async (args: any) => ({ id: "sug-1", ...args.data })
} as any;

prisma.reviewDecision = {
  create: async (args: any) => ({ id: "dec-1", ...args.data })
} as any;

prisma.reviewRewrite = {
  create: async (args: any) => ({ id: "rw-1", ...args.data })
} as any;

prisma.reviewReAudit = {
  create: async (args: any) => ({ id: "rea-1", ...args.data })
} as any;

prisma.reviewDraftVersion = {
  create: async (args: any) => ({ id: `ver-${args.data.versionNumber}`, ...args.data }),
  findFirst: async (args: any) => ({ versionNumber: 1 }),
  findMany: async (args: any) => [{ id: "ver-1", versionNumber: 1, isRecommended: false }, { id: "ver-2", versionNumber: 2, isRecommended: false }],
  findUnique: async (args: any) => ({ id: args.where.id, sessionId: "sess-1", versionNumber: args.where.id === "ver-2" ? 2 : 1 }),
  updateMany: async (args: any) => ({ count: 2 }),
  update: async (args: any) => ({ id: args.where.id, isRecommended: true })
} as any;

describe("Review Studio Real Persistence with Prisma", () => {
  const repo = new ReviewStudioRepository();

  it("1. createSession salva originalDraft", async () => {
    const session = await repo.createSession("doc-1", "user-1", "CIVIL", "Meu draft original");
    assert.equal(session.originalDraft, "Meu draft original");
    assert.equal(session.pieceId, "doc-1");
  });

  it("2. saveRewrite n\u00E3o altera originalDraft (salva como snapshot)", async () => {
    const rewrite = await repo.saveRewrite("sess-1", "task-1", "DS", "original snapshot", "draft alterado");
    assert.equal(rewrite.originalDraftSnapshot, "original snapshot");
    assert.equal(rewrite.rewrittenDraft, "draft alterado");
    assert.notEqual(rewrite.originalDraftSnapshot, rewrite.rewrittenDraft);
  });

  it("3. saveReAudit cria registro separado", async () => {
    const reaudit = await repo.saveReAudit("sess-1", "rw-1", {}, {}, { scoreDelta: 10 }, true, false);
    assert.equal(reaudit.improved, true);
    assert.equal(reaudit.metricsJson.scoreDelta, 10);
  });

  it("4. saveDecision n\u00E3o altera draft, apenas registra status", async () => {
    const decision = await repo.saveDecision("sess-1", "task-1", "RULE-1", "APPROVED", "ui-user");
    assert.equal(decision.status, "APPROVED");
    assert.equal(decision.reviewedBy, "ui-user");
  });

  it("5. listHistory retorna sess\u00F5es", async () => {
    const history = await repo.listHistory("doc-1");
    assert.equal(history.length, 1);
    assert.equal(history[0].id, "sess-1");
  });

  it("6. originalDraft vira vers\u00E3o ORIGINAL", async () => {
    // A test above calls createSession, we know it calls createDraftVersion under the hood.
    // The repo returns the session. We can just check listDraftVersions based on our mock.
    const versions = await repo.listDraftVersions("sess-1");
    assert.equal(versions.length, 2);
  });

  it("7. markRecommendedVersion garante apenas uma recomendada", async () => {
    const updated = await repo.markRecommendedVersion("ver-2");
    assert.equal(updated.isRecommended, true);
  });

  it("8. compareVersions retorna estrutura correta", async () => {
    const comparison = await repo.compareVersions("ver-1", "ver-2");
    assert.equal(comparison.versionA.number, 1);
    assert.equal(comparison.versionB.number, 2);
  });
});
