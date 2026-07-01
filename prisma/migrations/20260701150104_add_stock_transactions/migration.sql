-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('STOCK_IN', 'STOCK_OUT');

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddCheckConstraint (D-04: non-negative stock hard floor)
ALTER TABLE "products" ADD CONSTRAINT "products_current_stock_non_negative" CHECK ("currentStock" >= 0);
