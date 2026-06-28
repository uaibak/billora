-- CreateEnum
CREATE TYPE "OrganizationMemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationMemberRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- Backfill one owner organization per existing user.
INSERT INTO "Organization" ("id", "ownerId", "name", "slug", "createdAt", "updatedAt")
SELECT
    "id",
    "id",
    COALESCE(NULLIF("fullName", ''), "email") || '''s Organization',
    'org-' || "id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'member-' || "id",
    "id",
    "id",
    'OWNER'::"OrganizationMemberRole",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

-- Move businesses from direct user ownership to organization ownership.
ALTER TABLE "Business" ADD COLUMN "organizationId" TEXT;
UPDATE "Business" SET "organizationId" = "userId";
ALTER TABLE "Business" ALTER COLUMN "organizationId" SET NOT NULL;

-- DropIndex
DROP INDEX "Business_userId_idx";

-- DropForeignKey
ALTER TABLE "Business" DROP CONSTRAINT "Business_userId_fkey";

-- AlterTable
ALTER TABLE "Business" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_ownerId_idx" ON "Organization"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE INDEX "Business_organizationId_idx" ON "Business"("organizationId");

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
