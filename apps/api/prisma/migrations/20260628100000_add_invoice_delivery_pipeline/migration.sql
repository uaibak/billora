-- CreateEnum
CREATE TYPE "InvoiceDeliveryStatus" AS ENUM ('NOT_SENT', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoicePdfStatus" AS ENUM ('NOT_GENERATED', 'QUEUED', 'GENERATED', 'FAILED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_PDF_QUEUED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_PDF_GENERATED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_EMAIL_QUEUED';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_EMAIL_SENT';
ALTER TYPE "AuditAction" ADD VALUE 'INVOICE_EMAIL_FAILED';

-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "pdfStatus" "InvoicePdfStatus" NOT NULL DEFAULT 'NOT_GENERATED',
ADD COLUMN "pdfPath" TEXT,
ADD COLUMN "pdfGeneratedAt" TIMESTAMP(3),
ADD COLUMN "emailStatus" "InvoiceDeliveryStatus" NOT NULL DEFAULT 'NOT_SENT',
ADD COLUMN "emailedAt" TIMESTAMP(3),
ADD COLUMN "lastEmailError" TEXT;

UPDATE "Invoice" SET "publicToken" = "id" WHERE "publicToken" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "publicToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_publicToken_key" ON "Invoice"("publicToken");

-- CreateIndex
CREATE INDEX "Invoice_publicToken_idx" ON "Invoice"("publicToken");
