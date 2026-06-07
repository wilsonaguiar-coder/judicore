-- CreateEnum
CREATE TYPE "PieceGenerationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'TIMEOUT', 'CANCELED');

-- CreateTable
CREATE TABLE "piece_generations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "piece_type" TEXT NOT NULL,
    "user_orientation" TEXT,
    "status" "PieceGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "input_tokens_gemini" INTEGER NOT NULL DEFAULT 0,
    "output_tokens_gemini" INTEGER NOT NULL DEFAULT 0,
    "input_tokens_gpt" INTEGER NOT NULL DEFAULT 0,
    "output_tokens_gpt" INTEGER NOT NULL DEFAULT 0,
    "processing_time_ms" INTEGER,
    "error_message" TEXT,
    "generated_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "piece_generations_pkey" PRIMARY KEY ("id")
);
