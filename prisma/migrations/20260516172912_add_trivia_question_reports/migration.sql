-- CreateTable
CREATE TABLE "TriviaQuestionReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "animeId" INTEGER,
    "animeTitle" TEXT,
    "questionText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reporterUserId" TEXT,
    "resolvedByUserId" TEXT,
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "TriviaQuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriviaQuestionReport_questionId_idx" ON "TriviaQuestionReport"("questionId");

-- CreateIndex
CREATE INDEX "TriviaQuestionReport_animeId_idx" ON "TriviaQuestionReport"("animeId");

-- CreateIndex
CREATE INDEX "TriviaQuestionReport_status_idx" ON "TriviaQuestionReport"("status");
