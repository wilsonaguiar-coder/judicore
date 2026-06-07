import test from "node:test";
import assert from "node:assert";
import { prisma, QuotaService } from "@judicore/db";

test("Quota Regression - Only COMPLETED consumes quota", async () => {
  // Setup User
  const user = await prisma.user.create({
    data: {
      email: `quota-test-${Date.now()}@judicore.com`,
      name: "Comum Teste Quota",
      passwordHash: "123",
      monthlyPieceLimit: 50,
      piecesUsedCurrentCycle: 0
    }
  });

  const runTest = async (status: any, expectedUsed: number) => {
    const gen = await prisma.pieceGeneration.create({
      data: {
        userId: user.id,
        pieceType: "Petição",
        status: status
      }
    });

    try {
      await QuotaService.consumePieceQuota(user.id, gen.id);
    } catch (e: any) {
      if (status === "COMPLETED") throw e; // Should not throw
      // Expected to throw "Cota só pode ser consumida para peças concluídas com sucesso" for others
    }

    const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert.strictEqual(updatedUser?.piecesUsedCurrentCycle, expectedUsed, `Status ${status} should leave quota at ${expectedUsed}`);
  };

  // Test 1: COMPLETED increments
  await runTest("COMPLETED", 1);
  
  // Test 2: FAILED does not increment
  await runTest("FAILED", 1);
  
  // Test 3: TIMEOUT does not increment
  await runTest("TIMEOUT", 1);
  
  // Test 4: CANCELED does not increment
  await runTest("CANCELED", 1);

  // Test 5: COMPLETED increments again
  await runTest("COMPLETED", 2);

  // Cleanup
  await prisma.user.delete({ where: { id: user.id } });
});
