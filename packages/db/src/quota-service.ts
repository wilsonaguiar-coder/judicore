import { prisma } from "../index.js";

export class QuotaService {
  /**
   * Avança a data em 1 mês preservando o dia limite.
   * Exemplo: 31/01 -> 28/02 (ou 29/02), 31/03 -> 30/04
   */
  private static addOneMonth(date: Date): Date {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + 1);
    // Se o mês virar 2 vezes (ex: Jan 31 + 1 mês = Mar 03), recua pro último dia do mês esperado
    if (d.getDate() !== day) {
      d.setDate(0);
    }
    return d;
  }

  /**
   * Checa o ciclo do usuário. Se tiver passado da data final,
   * renova a cota preservando o dia de faturamento.
   */
  static async checkAndRenewCycle(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Usuário não encontrado");

    const now = new Date();
    
    // Se não tem ciclo ou já passou do fim do ciclo
    if (!user.currentCycleEnd || now > user.currentCycleEnd) {
      let newStart = user.currentCycleStart ? new Date(user.currentCycleStart) : now;
      let newEnd = user.currentCycleEnd ? new Date(user.currentCycleEnd) : this.addOneMonth(now);

      // Enquanto a data de término estiver no passado (caso tenha pulado meses de inatividade)
      // Avança os ciclos até alinhar ao mês atual
      while (newEnd <= now) {
        newStart = this.addOneMonth(newStart);
        newEnd = this.addOneMonth(newEnd);
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          piecesUsedCurrentCycle: 0,
          currentCycleStart: newStart,
          currentCycleEnd: newEnd,
        }
      });
    }
  }

  /**
   * Consome 1 cota de peça do usuário apenas se a geração foi concluída com sucesso (APPROVED).
   */
  static async consumePieceQuota(userId: string, generationId: string) {
    // 1. Verifica status da geração
    const generation = await prisma.legalGeneration.findUnique({ where: { id: generationId } });
    if (!generation) {
      throw new Error("Geração não encontrada");
    }

    if (generation.status !== "APPROVED") {
      throw new Error("Cota só pode ser consumida para peças concluídas/aprovadas.");
    }

    // 2. Renova ciclo se necessário
    await this.checkAndRenewCycle(userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("Usuário não encontrado");

    if (user.piecesUsedCurrentCycle >= user.monthlyPieceLimit) {
      throw new Error("Limite de peças do plano atingido neste ciclo.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        piecesUsedCurrentCycle: {
          increment: 1
        }
      }
    });
  }
}
