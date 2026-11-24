-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DONE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('TEXT', 'RATING', 'SINGLE', 'MULTI', 'YESNO');

-- CreateEnum
CREATE TYPE "TesterSource" AS ENUM ('INVITE_LINK', 'GUILD');

-- CreateEnum
CREATE TYPE "TesterStatus" AS ENUM ('INVITED', 'ACTIVE', 'PAUSED', 'INACTIVE', 'UNREACHABLE', 'OPTED_OUT');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('SCHEDULED', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnswerChannel" AS ENUM ('DISCORD', 'WEB');

-- CreateEnum
CREATE TYPE "TesterQuestionStatus" AS ENUM ('OPEN', 'ANSWERED');

-- CreateEnum
CREATE TYPE "AiUsageKind" AS ENUM ('GENERATE', 'SPLIT');

-- CreateEnum
CREATE TYPE "OutboundKind" AS ENUM ('WELCOME', 'MICROTEST', 'REMINDER', 'REPLY', 'FALLBACK_EMAIL');

-- CreateEnum
CREATE TYPE "OutboundStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productDescription" TEXT NOT NULL,
    "productUrl" TEXT,
    "welcomeMessage" TEXT,
    "deadline" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "cadenceHours" INTEGER NOT NULL DEFAULT 48,
    "reminder1Hours" INTEGER NOT NULL DEFAULT 24,
    "reminder2Hours" INTEGER NOT NULL DEFAULT 72,
    "inviteCode" TEXT NOT NULL,
    "discordGuildId" TEXT,
    "announceChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroTest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "microTestId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTemplate" (
    "id" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tester" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "source" "TesterSource" NOT NULL,
    "status" "TesterStatus" NOT NULL DEFAULT 'INVITED',
    "consentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "microTestId" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "currentQuestionIdx" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionSnapshot" JSONB NOT NULL,
    "value" JSONB NOT NULL,
    "channel" "AnswerChannel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TesterQuestion" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reply" TEXT,
    "repliedAt" TIMESTAMP(3),
    "status" "TesterQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TesterQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignId" TEXT,
    "kind" "AiUsageKind" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(10,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "testerId" TEXT NOT NULL,
    "kind" "OutboundKind" NOT NULL,
    "status" "OutboundStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_inviteCode_key" ON "Campaign"("inviteCode");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");

-- CreateIndex
CREATE INDEX "MicroTest_campaignId_position_idx" ON "MicroTest"("campaignId", "position");

-- CreateIndex
CREATE INDEX "Question_microTestId_position_idx" ON "Question"("microTestId", "position");

-- CreateIndex
CREATE INDEX "Tester_campaignId_status_idx" ON "Tester"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tester_campaignId_discordUserId_key" ON "Tester"("campaignId", "discordUserId");

-- CreateIndex
CREATE INDEX "Assignment_status_scheduledAt_idx" ON "Assignment"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_testerId_microTestId_key" ON "Assignment"("testerId", "microTestId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_assignmentId_questionId_key" ON "Answer"("assignmentId", "questionId");

-- CreateIndex
CREATE INDEX "TesterQuestion_testerId_status_idx" ON "TesterQuestion"("testerId", "status");

-- CreateIndex
CREATE INDEX "AiUsage_userId_createdAt_idx" ON "AiUsage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "OutboundMessage_testerId_idx" ON "OutboundMessage"("testerId");

-- CreateIndex
CREATE INDEX "OutboundMessage_status_createdAt_idx" ON "OutboundMessage"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroTest" ADD CONSTRAINT "MicroTest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_microTestId_fkey" FOREIGN KEY ("microTestId") REFERENCES "MicroTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tester" ADD CONSTRAINT "Tester_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_microTestId_fkey" FOREIGN KEY ("microTestId") REFERENCES "MicroTest"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TesterQuestion" ADD CONSTRAINT "TesterQuestion_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_testerId_fkey" FOREIGN KEY ("testerId") REFERENCES "Tester"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ajout manuel (Prisma ne sait pas exprimer DEFERRABLE) : voir docs/decisions.md.
-- Ces deux FK sont en NO ACTION pour qu'on ne supprime jamais une question répondue ou un
-- micro-test envoyé (on les archive). Le contrôle est différé au commit : supprimer une
-- campagne marche quand même, une fois que les cascades Tester -> Assignment -> Answer ont tourné.
ALTER TABLE "Assignment" ALTER CONSTRAINT "Assignment_microTestId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "Answer" ALTER CONSTRAINT "Answer_questionId_fkey" DEFERRABLE INITIALLY DEFERRED;
