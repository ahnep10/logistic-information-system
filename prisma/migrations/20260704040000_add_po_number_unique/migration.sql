-- AddUniqueConstraint
-- WR-01: poNumber is the human-facing PO identifier (rendered as PO-0001);
-- nothing at the database layer previously guaranteed uniqueness.
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_poNumber_key" UNIQUE ("poNumber");
