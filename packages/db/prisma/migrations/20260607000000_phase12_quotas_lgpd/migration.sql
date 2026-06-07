-- AlterTable
ALTER TABLE "users" ADD COLUMN "monthly_piece_limit" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN "pieces_used_current_cycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "current_cycle_start" TIMESTAMP(3),
ADD COLUMN "current_cycle_end" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "piece_document_metadata" (
    "id" TEXT NOT NULL,
    "generation_id" TEXT,
    "original_name" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "piece_document_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "piece_document_metadata_generationId_idx" ON "piece_document_metadata"("generation_id");
