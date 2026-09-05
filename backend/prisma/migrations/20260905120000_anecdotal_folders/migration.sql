-- Anecdotal record folders (teacher-owned collections of filed GCForm-01
-- records). Purely additive: new table + nullable column, no data touched.

-- CreateTable
CREATE TABLE "AnecdotalFolder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnecdotalFolder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnecdotalFolder_ownerId_idx" ON "AnecdotalFolder"("ownerId");

-- AlterTable
ALTER TABLE "AnecdotalRecord" ADD COLUMN "folderId" TEXT;

-- CreateIndex
CREATE INDEX "AnecdotalRecord_folderId_idx" ON "AnecdotalRecord"("folderId");

-- AddForeignKey
ALTER TABLE "AnecdotalRecord" ADD CONSTRAINT "AnecdotalRecord_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "AnecdotalFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnecdotalFolder" ADD CONSTRAINT "AnecdotalFolder_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
