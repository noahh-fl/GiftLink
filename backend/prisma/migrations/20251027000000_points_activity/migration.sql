PRAGMA foreign_keys=OFF;

CREATE TABLE "LedgerEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spaceId" INTEGER NOT NULL,
    "userKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "LedgerEntry_spaceId_userKey_createdAt_idx" ON "LedgerEntry" ("spaceId", "userKey", "createdAt" DESC);

CREATE TABLE "Activity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spaceId" INTEGER NOT NULL,
    "actorKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Activity_spaceId_createdAt_idx" ON "Activity" ("spaceId", "createdAt" DESC);

CREATE TABLE "RewardRedemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spaceId" INTEGER NOT NULL,
    "rewardId" INTEGER NOT NULL,
    "redeemerKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RewardRedemption_rewardId_fkey" FOREIGN KEY ("rewardId") REFERENCES "Reward" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RewardRedemption_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "RewardRedemption_spaceId_redeemerKey_createdAt_idx" ON "RewardRedemption" ("spaceId", "redeemerKey", "createdAt" DESC);

ALTER TABLE "Reward" ADD COLUMN "icon" TEXT;

PRAGMA foreign_keys=ON;
