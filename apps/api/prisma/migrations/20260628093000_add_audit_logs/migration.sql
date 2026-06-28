-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM (
  'ORGANIZATION_CREATED',
  'ORGANIZATION_UPDATED',
  'BUSINESS_CREATED',
  'BUSINESS_UPDATED',
  'BUSINESS_DELETED',
  'CUSTOMER_CREATED',
  'CUSTOMER_UPDATED',
  'CUSTOMER_DELETED',
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_DELETED',
  'INVOICE_SENT',
  'INVOICE_MARKED_PAID',
  'PAYMENT_RECORDED'
);

-- CreateEnum
CREATE TYPE "AuditEntityType" AS ENUM ('ORGANIZATION', 'BUSINESS', 'CUSTOMER', 'INVOICE', 'PAYMENT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
