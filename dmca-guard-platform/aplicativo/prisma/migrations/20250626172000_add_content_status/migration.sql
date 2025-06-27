-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DETECTED', 'REVIEWED', 'DMCA_SENT', 'PENDING_REVIEW', 'DELISTED', 'REJECTED', 'FALSE_POSITIVE', 'IGNORED');

-- AlterTable
ALTER TABLE "detected_content" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "status" "ContentStatus" NOT NULL DEFAULT 'DETECTED';
