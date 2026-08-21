-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "TriviaDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TriviaCategory" AS ENUM ('CHARACTER', 'AUTHOR', 'SETTING', 'VALUES', 'RELIGION', 'RACES', 'PLOT', 'WORLD_BUILDING', 'PRODUCTION', 'GENERAL');

-- CreateEnum
CREATE TYPE "TriviaQuestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TriviaQuestionSource" AS ENUM ('OFFICIAL', 'USER_SUBMITTED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "TriviaQuestion" (
    "id" TEXT NOT NULL,
    "animeId" INTEGER NOT NULL,
    "externalAnimeId" TEXT,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctAnswerIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "difficulty" "TriviaDifficulty" NOT NULL,
    "category" "TriviaCategory" NOT NULL DEFAULT 'GENERAL',
    "status" "TriviaQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "TriviaQuestionSource" NOT NULL DEFAULT 'USER_SUBMITTED',
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "TriviaQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TriviaQuestion_animeId_idx" ON "TriviaQuestion"("animeId");

-- CreateIndex
CREATE INDEX "TriviaQuestion_animeId_status_idx" ON "TriviaQuestion"("animeId", "status");

-- CreateIndex
CREATE INDEX "TriviaQuestion_animeId_status_difficulty_idx" ON "TriviaQuestion"("animeId", "status", "difficulty");

-- CreateIndex
CREATE INDEX "TriviaQuestion_createdByUserId_idx" ON "TriviaQuestion"("createdByUserId");

-- CreateIndex
CREATE INDEX "TriviaQuestion_reviewedByUserId_idx" ON "TriviaQuestion"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "TriviaQuestion_status_idx" ON "TriviaQuestion"("status");

-- CreateIndex
CREATE INDEX "TriviaQuestion_difficulty_idx" ON "TriviaQuestion"("difficulty");

-- CreateIndex
CREATE INDEX "TriviaQuestion_category_idx" ON "TriviaQuestion"("category");

-- AddForeignKey
ALTER TABLE "TriviaQuestion" ADD CONSTRAINT "TriviaQuestion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TriviaQuestion" ADD CONSTRAINT "TriviaQuestion_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
