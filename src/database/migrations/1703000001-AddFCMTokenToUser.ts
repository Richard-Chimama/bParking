import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFCMTokenToUser1703000001 implements MigrationInterface {
  name = 'AddFCMTokenToUser1703000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'fcm_token',
        type: 'varchar',
        length: '500',
        isNullable: true,
        comment: 'Firebase Cloud Messaging token for push notifications'
      })
    );

    // Create index for faster FCM token lookups
    await queryRunner.query(
      `CREATE INDEX "IDX_users_fcm_token" ON "users" ("fcm_token") WHERE "fcm_token" IS NOT NULL`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_fcm_token"`);
    await queryRunner.dropColumn('users', 'fcm_token');
  }
}