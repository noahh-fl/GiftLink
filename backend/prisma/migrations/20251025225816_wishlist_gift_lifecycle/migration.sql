/*
  Warnings:

  - You are about to drop the column `category` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `confirmed` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `spaceId` on the `Gift` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Gift` table. All the data in the column will be lost.
  - Added the required column `wishlistItemId` to the `Gift` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spaceId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "image" TEXT,
    "priceCents" INTEGER,
    "category" TEXT,
    "notes" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WishlistItem_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Gift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wishlistItemId" INTEGER NOT NULL,
    "giverId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentimentPoints" INTEGER,
    "pricePointsLocked" INTEGER,
    "reservedAt" DATETIME,
    "purchasedAt" DATETIME,
    "deliveredAt" DATETIME,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Gift_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Gift_giverId_fkey" FOREIGN KEY ("giverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Gift" ("createdAt", "id", "updatedAt") SELECT "createdAt", "id", "updatedAt" FROM "Gift";
DROP TABLE "Gift";
ALTER TABLE "new_Gift" RENAME TO "Gift";
CREATE UNIQUE INDEX "Gift_wishlistItemId_key" ON "Gift"("wishlistItemId");
CREATE INDEX "Gift_wishlistItemId_idx" ON "Gift"("wishlistItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
