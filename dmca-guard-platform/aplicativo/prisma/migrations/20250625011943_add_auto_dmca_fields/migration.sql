-- AlterTable
ALTER TABLE "detected_content" ADD COLUMN     "confidence" INTEGER DEFAULT 0,
ADD COLUMN     "faceMatchConfidence" DOUBLE PRECISION,
ADD COLUMN     "imagesFound" TEXT[],
ADD COLUMN     "keywordSource" TEXT,
ADD COLUMN     "platformType" TEXT;

-- CreateTable
CREATE TABLE "dmca_contact_info" (
    "id" TEXT NOT NULL,
    "detectedContentId" TEXT NOT NULL,
    "email" TEXT,
    "isCompliant" BOOLEAN NOT NULL DEFAULT false,
    "contactPage" TEXT,
    "detectedMethod" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "additionalEmails" TEXT[],
    "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dmca_contact_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keyword_searches" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "lastSearchedAt" TIMESTAMP(3),
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "effectiveness" DOUBLE PRECISION DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keyword_searches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_results" (
    "id" TEXT NOT NULL,
    "keywordSearchId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "snippet" TEXT,
    "source" TEXT NOT NULL,
    "rankPosition" INTEGER,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reference_images" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "faceId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reference_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dmca_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "activeThreats" INTEGER,
    "removalSuccess" INTEGER,
    "responseTime" INTEGER,
    "coverage" INTEGER,
    "level" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dmca_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dmca_contact_info_detectedContentId_key" ON "dmca_contact_info"("detectedContentId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_searches_userId_keyword_platform_key" ON "keyword_searches"("userId", "keyword", "platform");

-- AddForeignKey
ALTER TABLE "dmca_contact_info" ADD CONSTRAINT "dmca_contact_info_detectedContentId_fkey" FOREIGN KEY ("detectedContentId") REFERENCES "detected_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keyword_searches" ADD CONSTRAINT "keyword_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_results" ADD CONSTRAINT "search_results_keywordSearchId_fkey" FOREIGN KEY ("keywordSearchId") REFERENCES "keyword_searches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reference_images" ADD CONSTRAINT "reference_images_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dmca_scores" ADD CONSTRAINT "dmca_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
