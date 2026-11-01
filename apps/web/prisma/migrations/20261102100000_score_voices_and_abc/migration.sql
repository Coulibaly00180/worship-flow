-- AlterTable : partitions par voix + partitions saisies en notation ABC
ALTER TABLE "SongScore"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'FILE',
  ADD COLUMN "voice" TEXT NOT NULL DEFAULT 'ALL',
  ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "abc" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "data" DROP NOT NULL;

-- DropIndex / CreateIndex
DROP INDEX "SongScore_songId_idx";
CREATE INDEX "SongScore_songId_position_idx" ON "SongScore"("songId", "position");
