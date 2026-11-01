-- CreateTable
CREATE TABLE "SongScore" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SongScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SongScore_songId_idx" ON "SongScore"("songId");

-- AddForeignKey
ALTER TABLE "SongScore" ADD CONSTRAINT "SongScore_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
