import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerRole1700000000001 implements MigrationInterface {
  name = 'AddOwnerRole1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'owner' to the role enum
    await queryRunner.query(`
      ALTER TYPE "public"."users_role_enum" ADD VALUE 'owner'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum without 'owner'
    // For now, we'll leave it as a comment
    console.log('Warning: Cannot easily remove enum value in PostgreSQL');
  }
} 