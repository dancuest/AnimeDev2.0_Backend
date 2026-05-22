/*
  Warnings:

  - The primary key for the `UserSettings` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `UserSettings` table. All the data in the column will be lost.
  - The `preferredDurations` column on the `UserSettings` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `AnimeCache` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Made the column `ageRange` on table `UserSettings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `genderCode` on table `UserSettings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `regionCode` on table `UserSettings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `toggles` on table `UserSettings` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "UserInteraction_animeId_idx";

-- DropIndex
DROP INDEX "UserInteraction_type_idx";

-- DropIndex
DROP INDEX "UserInteraction_userId_idx";

-- DropIndex
DROP INDEX "UserSettings_userId_key";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "deviceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_pkey",
DROP COLUMN "id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "ageRange" SET NOT NULL,
ALTER COLUMN "ageRange" SET DEFAULT 0,
ALTER COLUMN "genderCode" SET NOT NULL,
ALTER COLUMN "genderCode" SET DEFAULT 0,
ALTER COLUMN "regionCode" SET NOT NULL,
ALTER COLUMN "regionCode" SET DEFAULT 0,
ALTER COLUMN "preferredGenres" SET DEFAULT ARRAY[]::INTEGER[],
DROP COLUMN "preferredDurations",
ADD COLUMN     "preferredDurations" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "toggles" SET NOT NULL,
ALTER COLUMN "toggles" SET DEFAULT '{}',
ADD CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("userId");

-- DropTable
DROP TABLE "AnimeCache";

-- DropEnum
DROP TYPE "DurationType";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_animeId_idx" ON "UserInteraction"("userId", "animeId");

-- CreateIndex
CREATE INDEX "UserInteraction_userId_type_idx" ON "UserInteraction"("userId", "type");
