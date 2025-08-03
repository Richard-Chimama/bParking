import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable PostGIS extension for spatial data
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "postgis"`);

    // Create enum for user roles
    await queryRunner.query(`CREATE TYPE "public"."user_role_enum" AS ENUM('user', 'admin')`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "firstName" character varying(50) NOT NULL,
        "lastName" character varying(50) NOT NULL,
        "email" character varying NOT NULL,
        "phoneNumber" character varying NOT NULL,
        "password" character varying NOT NULL,
        "role" "public"."user_role_enum" NOT NULL DEFAULT 'user',
        "isVerified" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT true,
        "otpCode" character varying,
        "otpExpiresAt" TIMESTAMP,
        "profilePicture" character varying,
        "dateOfBirth" date,
        "address" jsonb,
        "preferences" jsonb,
        "lastLoginAt" TIMESTAMP,
        "loginAttempts" integer NOT NULL DEFAULT '0',
        "lockUntil" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
        CONSTRAINT "UQ_1d0509c1c8e0c0c0c0c0c0c0c0c" UNIQUE ("phoneNumber"),
        CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
      )
    `);

    // Create parkings table
    await queryRunner.query(`
      CREATE TABLE "parkings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(100) NOT NULL,
        "description" text NOT NULL,
        "address" jsonb NOT NULL,
        "location" geometry(Point,4326) NOT NULL,
        "totalSpaces" integer NOT NULL,
        "availableSpaces" integer NOT NULL,
        "parkingSpaces" jsonb NOT NULL,
        "pricing" jsonb NOT NULL,
        "amenities" text array NOT NULL DEFAULT '{}',
        "images" text array NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "isVerified" boolean NOT NULL DEFAULT false,
        "ownerId" uuid NOT NULL,
        "operatingHours" jsonb NOT NULL,
        "rules" text array NOT NULL DEFAULT '{}',
        "contactInfo" jsonb NOT NULL,
        "rating" decimal(3,2) NOT NULL DEFAULT '0',
        "totalReviews" integer NOT NULL DEFAULT '0',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_parkings_id" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraint
    await queryRunner.query(`
      ALTER TABLE "parkings" 
      ADD CONSTRAINT "FK_parkings_owner" 
      FOREIGN KEY ("ownerId") 
      REFERENCES "users"("id") 
      ON DELETE CASCADE
    `);

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_phoneNumber" ON "users" ("phoneNumber")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_isVerified" ON "users" ("isVerified")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_createdAt" ON "users" ("createdAt")`);
    
    await queryRunner.query(`CREATE INDEX "IDX_parkings_location" ON "parkings" USING GIST ("location")`);
    await queryRunner.query(`CREATE INDEX "IDX_parkings_owner" ON "parkings" ("ownerId")`);
    await queryRunner.query(`CREATE INDEX "IDX_parkings_isActive" ON "parkings" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_parkings_isVerified" ON "parkings" ("isVerified")`);
    await queryRunner.query(`CREATE INDEX "IDX_parkings_rating" ON "parkings" ("rating")`);
    await queryRunner.query(`CREATE INDEX "IDX_parkings_createdAt" ON "parkings" ("createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX "IDX_parkings_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_parkings_rating"`);
    await queryRunner.query(`DROP INDEX "IDX_parkings_isVerified"`);
    await queryRunner.query(`DROP INDEX "IDX_parkings_isActive"`);
    await queryRunner.query(`DROP INDEX "IDX_parkings_owner"`);
    await queryRunner.query(`DROP INDEX "IDX_parkings_location"`);
    
    await queryRunner.query(`DROP INDEX "IDX_users_createdAt"`);
    await queryRunner.query(`DROP INDEX "IDX_users_isVerified"`);
    await queryRunner.query(`DROP INDEX "IDX_users_role"`);
    await queryRunner.query(`DROP INDEX "IDX_users_phoneNumber"`);
    await queryRunner.query(`DROP INDEX "IDX_users_email"`);

    // Drop foreign key constraint
    await queryRunner.query(`ALTER TABLE "parkings" DROP CONSTRAINT "FK_parkings_owner"`);

    // Drop tables
    await queryRunner.query(`DROP TABLE "parkings"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enum
    await queryRunner.query(`DROP TYPE "public"."user_role_enum"`);
  }
} 