// Mock do Prisma para testes de unidade do QuotaService
import { QuotaService } from "../quota-service";
import { prisma } from "../index";

jest.mock("../index", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    legalGeneration: {
      findUnique: jest.fn(),
    }
  }
}));

describe("QuotaService Hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Renovação e Ciclos (checkAndRenewCycle)", () => {
    it("Deve renovar corretamente avançando 1 mês (usuário antigo com ciclo expirado)", async () => {
      const pastStart = new Date("2026-05-15T10:00:00Z");
      const pastEnd = new Date("2026-06-15T10:00:00Z");

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user1",
        currentCycleStart: pastStart,
        currentCycleEnd: pastEnd,
      });

      // Se executado após 15 de Junho, deve setar para 15 de Julho.
      // Mockaremos Date globalmente para simular o "now"
      jest.useFakeTimers().setSystemTime(new Date("2026-06-16T10:00:00Z"));

      await QuotaService.checkAndRenewCycle("user1");

      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "user1" },
        data: expect.objectContaining({
          piecesUsedCurrentCycle: 0,
          currentCycleStart: expect.any(Date),
          currentCycleEnd: expect.any(Date),
        })
      }));
      
      jest.useRealTimers();
    });

    it("Deve lidar com ano bissexto / virada de fevereiro sem pular mês", async () => {
      const pastStart = new Date("2024-01-31T10:00:00Z");
      const pastEnd = new Date("2024-02-29T10:00:00Z"); // Bissexto

      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user2",
        currentCycleStart: pastStart,
        currentCycleEnd: pastEnd,
      });

      jest.useFakeTimers().setSystemTime(new Date("2024-03-01T10:00:00Z"));

      await QuotaService.checkAndRenewCycle("user2");

      const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
      const newEnd: Date = updateCall.data.currentCycleEnd;
      
      // Espera-se que termine final de março (31)
      expect(newEnd.getMonth()).toBe(2); // Março
      
      jest.useRealTimers();
    });
  });

  describe("Consumo de Cota", () => {
    it("Deve consumir cota quando a geração for APPROVED", async () => {
      (prisma.legalGeneration.findUnique as jest.Mock).mockResolvedValue({
        id: "gen1",
        status: "APPROVED"
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user3",
        monthlyPieceLimit: 50,
        piecesUsedCurrentCycle: 10,
        currentCycleEnd: new Date("2099-01-01T00:00:00Z") // ciclo válido
      });

      await expect(QuotaService.consumePieceQuota("user3", "gen1")).resolves.not.toThrow();
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("NÃO deve consumir cota quando a geração for FAILED ou diferente de APPROVED", async () => {
      (prisma.legalGeneration.findUnique as jest.Mock).mockResolvedValue({
        id: "gen1",
        status: "FAILED"
      });

      await expect(QuotaService.consumePieceQuota("user3", "gen1")).rejects.toThrow("Cota só pode ser consumida para peças concluídas/aprovadas.");
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("Deve bloquear geração se cota estiver cheia", async () => {
      (prisma.legalGeneration.findUnique as jest.Mock).mockResolvedValue({
        id: "gen1",
        status: "APPROVED"
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user4",
        monthlyPieceLimit: 50,
        piecesUsedCurrentCycle: 50, // Cota cheia
        currentCycleEnd: new Date("2099-01-01T00:00:00Z")
      });

      await expect(QuotaService.consumePieceQuota("user4", "gen1")).rejects.toThrow("Limite de peças do plano atingido neste ciclo.");
    });
  });
});
