-- DropForeignKey
ALTER TABLE "public"."designs" DROP CONSTRAINT "designs_category_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."sub_categories" DROP CONSTRAINT "sub_categories_category_id_fkey";

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "country" DROP NOT NULL;

-- AlterTable
ALTER TABLE "designs" ADD COLUMN     "diamond_color" VARCHAR(50),
ADD COLUMN     "diamond_quality" VARCHAR(50),
ADD COLUMN     "diamond_sizes" JSONB,
ALTER COLUMN "design_no" DROP NOT NULL,
ALTER COLUMN "design_date" DROP NOT NULL,
ALTER COLUMN "category_id" DROP NOT NULL,
ALTER COLUMN "metal_quality" DROP NOT NULL;

-- AlterTable
ALTER TABLE "stock_items" ADD COLUMN     "diamond_sizes" JSONB,
ADD COLUMN     "product_name" VARCHAR(255),
ADD COLUMN     "stone_weight" DECIMAL(12,3),
ALTER COLUMN "tag_no" DROP NOT NULL,
ALTER COLUMN "metal_quality" DROP NOT NULL,
ALTER COLUMN "gross_weight" DROP NOT NULL,
ALTER COLUMN "net_weight" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sub_categories" ALTER COLUMN "category_id" DROP NOT NULL,
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "suppliers" ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "mobile" DROP NOT NULL,
ALTER COLUMN "country" DROP NOT NULL;

-- CreateTable
CREATE TABLE "sales" (
    "id" UUID NOT NULL,
    "invoice_no" VARCHAR(50),
    "customer_id" UUID,
    "customer_name" VARCHAR(150),
    "date" DATE,
    "invoice_type" VARCHAR(80),
    "tax_type" VARCHAR(80),
    "tds_type" VARCHAR(80),
    "tds_percent" DECIMAL(5,2),
    "tds_amount" DECIMAL(12,2),
    "place_of_supply" VARCHAR(150),
    "currency" VARCHAR(10) DEFAULT 'INR',
    "exchange_rate" DECIMAL(12,4),
    "selected_job" VARCHAR(100),
    "stock_type" VARCHAR(50),
    "purity_ratio" DECIMAL(12,3),
    "wastage" DECIMAL(12,3),
    "metal_rate" DECIMAL(12,2),
    "diamond_rate" DECIMAL(12,2),
    "stone_rate" DECIMAL(12,2),
    "stone_rate_on_pcs" BOOLEAN NOT NULL DEFAULT false,
    "misc_rate" DECIMAL(12,2),
    "disc_percent" DECIMAL(5,2),
    "disc_amt" DECIMAL(12,2),
    "metal" VARCHAR(50),
    "labour_rate" DECIMAL(12,2),
    "items" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "customer_code" VARCHAR(30),
    "customer_name" VARCHAR(150),
    "items" JSONB NOT NULL,
    "total_gross" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "total_net" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "total_pure" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "total_diamond" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "item_count" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoice_no_key" ON "sales"("invoice_no");

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "designs" ADD CONSTRAINT "designs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
