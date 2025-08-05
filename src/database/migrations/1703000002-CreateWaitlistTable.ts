import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateWaitlistTable1703000002 implements MigrationInterface {
  name = 'CreateWaitlistTable1703000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'waitlists',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()'
          },
          {
            name: 'user_id',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'parking_id',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'notified', 'expired', 'cancelled', 'converted'],
            default: "'active'"
          },
          {
            name: 'position',
            type: 'integer',
            isNullable: false,
            default: 1
          },
          {
            name: 'desired_start_time',
            type: 'timestamp with time zone',
            isNullable: false
          },
          {
            name: 'desired_end_time',
            type: 'timestamp with time zone',
            isNullable: false
          },
          {
            name: 'required_spaces',
            type: 'integer',
            isNullable: false,
            default: 1
          },
          {
            name: 'vehicle_info',
            type: 'text',
            isNullable: true
          },
          {
            name: 'special_requests',
            type: 'text',
            isNullable: true
          },
          {
            name: 'notification_history',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'"
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'notified_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'created_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          },
          {
            name: 'updated_at',
            type: 'timestamp with time zone',
            default: 'CURRENT_TIMESTAMP'
          }
        ]
      }),
      true
    );

    // Create foreign key constraints
    await queryRunner.createForeignKey(
      'waitlists',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'waitlists',
      new TableForeignKey({
        columnNames: ['parking_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'parkings',
        onDelete: 'CASCADE'
      })
    );

    // Create indexes for better performance
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_user_id',
      columnNames: ['user_id']
    }));
    
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_parking_id',
      columnNames: ['parking_id']
    }));
    
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_status',
      columnNames: ['status']
    }));
    
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_parking_status_position',
      columnNames: ['parking_id', 'status', 'position']
    }));
    
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_desired_times',
      columnNames: ['desired_start_time', 'desired_end_time']
    }));
    
    await queryRunner.createIndex('waitlists', new TableIndex({
      name: 'IDX_waitlists_expires_at',
      columnNames: ['expires_at']
    }));

    // Create updated_at trigger
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_waitlists_updated_at
        BEFORE UPDATE ON waitlists
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_waitlists_updated_at ON waitlists`);
    await queryRunner.dropTable('waitlists');
  }
}