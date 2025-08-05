import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingSystem1700000000002 implements MigrationInterface {
  name = 'AddBookingSystem1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create booking status enum
    await queryRunner.query(`
      CREATE TYPE "public"."booking_status_enum" AS ENUM(
        'pending', 'confirmed', 'active', 'completed', 'cancelled', 'no_show'
      )
    `);

    // Create payment status enum
    await queryRunner.query(`
      CREATE TYPE "public"."payment_status_enum" AS ENUM(
        'pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded', 'partial_refund', 'expired'
      )
    `);

    // Create payment method enum
    await queryRunner.query(`
      CREATE TYPE "public"."payment_method_enum" AS ENUM(
        'mtn_mobile_money', 'airtel_money', 'zamtel_kwacha', 'credit_card', 'debit_card', 'cash', 'bank_transfer'
      )
    `);

    // Create payment provider enum
    await queryRunner.query(`
      CREATE TYPE "public"."payment_provider_enum" AS ENUM(
        'mtn_zambia', 'airtel_zambia', 'zamtel', 'visa', 'mastercard', 'manual'
      )
    `);

    // Create bookings table
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "parkingId" uuid NOT NULL,
        "spaceId" character varying(50) NOT NULL,
        "startTime" TIMESTAMP NOT NULL,
        "endTime" TIMESTAMP NOT NULL,
        "status" "public"."booking_status_enum" NOT NULL DEFAULT 'pending',
        "totalAmount" decimal(10,2) NOT NULL,
        "paymentStatus" "public"."payment_status_enum" NOT NULL DEFAULT 'pending',
        "paymentId" uuid,
        "bookingReference" character varying(20) NOT NULL,
        "vehicleInfo" jsonb NOT NULL,
        "specialRequests" text,
        "checkInTime" TIMESTAMP,
        "checkOutTime" TIMESTAMP,
        "cancellationReason" jsonb,
        "extensionHistory" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_bookings_reference" UNIQUE ("bookingReference")
      )
    `);

    // Create payments table
    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "amount" decimal(10,2) NOT NULL,
        "currency" character varying(3) NOT NULL DEFAULT 'ZMW',
        "paymentMethod" "public"."payment_method_enum" NOT NULL,
        "provider" "public"."payment_provider_enum" NOT NULL,
        "transactionId" character varying(100) NOT NULL,
        "providerTransactionId" character varying(100),
        "status" "public"."payment_status_enum" NOT NULL DEFAULT 'pending',
        "providerResponse" jsonb,
        "paymentDetails" jsonb,
        "refundDetails" jsonb,
        "paidAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "failureReason" text,
        "webhookData" jsonb,
        "retryCount" integer NOT NULL DEFAULT 0,
        "lastRetryAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payments_transaction" UNIQUE ("transactionId")
      )
    `);

    // Add foreign key constraints for bookings
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "FK_bookings_user" 
      FOREIGN KEY ("userId") 
      REFERENCES "users"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "FK_bookings_parking" 
      FOREIGN KEY ("parkingId") 
      REFERENCES "parkings"("id") 
      ON DELETE CASCADE
    `);

    // Add foreign key constraints for payments
    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_booking" 
      FOREIGN KEY ("bookingId") 
      REFERENCES "bookings"("id") 
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "FK_payments_user" 
      FOREIGN KEY ("userId") 
      REFERENCES "users"("id") 
      ON DELETE CASCADE
    `);

    // Create indexes for bookings
    await queryRunner.query(`CREATE INDEX "IDX_bookings_user" ON "bookings" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_parking" ON "bookings" ("parkingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_status" ON "bookings" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_start_time" ON "bookings" ("startTime")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_end_time" ON "bookings" ("endTime")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_reference" ON "bookings" ("bookingReference")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_created_at" ON "bookings" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_payment_status" ON "bookings" ("paymentStatus")`);
    
    // Composite indexes for common queries
    await queryRunner.query(`CREATE INDEX "IDX_bookings_user_status" ON "bookings" ("userId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_parking_time" ON "bookings" ("parkingId", "startTime", "endTime")`);
    await queryRunner.query(`CREATE INDEX "IDX_bookings_active_time" ON "bookings" ("status", "startTime", "endTime") WHERE "status" IN ('confirmed', 'active')`);

    // Create indexes for payments
    await queryRunner.query(`CREATE INDEX "IDX_payments_booking" ON "payments" ("bookingId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_user" ON "payments" ("userId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_status" ON "payments" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_method" ON "payments" ("paymentMethod")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_transaction" ON "payments" ("transactionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_provider_transaction" ON "payments" ("providerTransactionId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_created_at" ON "payments" ("createdAt")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_paid_at" ON "payments" ("paidAt")`);
    
    // Composite indexes for payments
    await queryRunner.query(`CREATE INDEX "IDX_payments_user_status" ON "payments" ("userId", "status")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_method_status" ON "payments" ("paymentMethod", "status")`);

    // Add check constraints
    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "CHK_bookings_time_order" 
      CHECK ("startTime" < "endTime")
    `);

    await queryRunner.query(`
      ALTER TABLE "bookings" 
      ADD CONSTRAINT "CHK_bookings_amount_positive" 
      CHECK ("totalAmount" > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "CHK_payments_amount_positive" 
      CHECK ("amount" > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE "payments" 
      ADD CONSTRAINT "CHK_payments_retry_count" 
      CHECK ("retryCount" >= 0 AND "retryCount" <= 10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop check constraints
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "CHK_payments_retry_count"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "CHK_payments_amount_positive"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_amount_positive"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_time_order"`);

    // Drop indexes for payments
    await queryRunner.query(`DROP INDEX "IDX_payments_method_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_user_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_paid_at"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_provider_transaction"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_transaction"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_method"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_status"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_user"`);
    await queryRunner.query(`DROP INDEX "IDX_payments_booking"`);

    // Drop indexes for bookings
    await queryRunner.query(`DROP INDEX "IDX_bookings_active_time"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_parking_time"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_user_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_payment_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_created_at"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_reference"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_end_time"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_start_time"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_status"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_parking"`);
    await queryRunner.query(`DROP INDEX "IDX_bookings_user"`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_user"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_booking"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_parking"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_user"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "payments"`);
    await queryRunner.query(`DROP TABLE "bookings"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."payment_provider_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_method_enum"`);
    await queryRunner.query(`DROP TYPE "public"."payment_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."booking_status_enum"`);
  }
}