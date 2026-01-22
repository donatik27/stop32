-- CreateTable
CREATE TABLE "TelegramAlert" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "marketTitle" TEXT NOT NULL,
    "marketSlug" TEXT,
    "outcome" TEXT,
    "priceOld" DOUBLE PRECISION,
    "priceNew" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "percentChange" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "direction" TEXT,
    "sizeUsd" DOUBLE PRECISION,
    "wallet" TEXT,
    "alertTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramAlert_type_alertTimestamp_idx" ON "TelegramAlert"("type", "alertTimestamp");

-- CreateIndex
CREATE INDEX "TelegramAlert_alertTimestamp_idx" ON "TelegramAlert"("alertTimestamp");

-- CreateIndex
CREATE INDEX "TelegramAlert_marketSlug_idx" ON "TelegramAlert"("marketSlug");
