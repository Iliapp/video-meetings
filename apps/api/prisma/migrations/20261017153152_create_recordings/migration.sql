-- CreateEnum
CREATE TYPE "RecordingKind" AS ENUM ('video', 'audio');

-- CreateTable
CREATE TABLE "recordings" (
    "id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "kind" "RecordingKind" NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "duration_seconds" DOUBLE PRECISION,
    "storage_key" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recordings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recordings_storage_key_key" ON "recordings"("storage_key");

-- CreateIndex
CREATE INDEX "recordings_meeting_id_created_at_idx" ON "recordings"("meeting_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordings" ADD CONSTRAINT "recordings_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
