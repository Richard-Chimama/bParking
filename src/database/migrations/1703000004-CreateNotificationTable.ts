import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateNotificationTable1703000004 implements MigrationInterface {
  name = 'CreateNotificationTable1703000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'notifications',
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
            name: 'type',
            type: 'enum',
            enum: ['booking', 'payment', 'waitlist', 'reminder', 'general', 'marketing', 'system'],
            isNullable: false
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
            default: "'pending'"
          },
          {
            name: 'channel',
            type: 'enum',
            enum: ['push', 'email', 'sms', 'websocket'],
            isNullable: false
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
            isNullable: false
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false
          },
          {
            name: 'data',
            type: 'jsonb',
            isNullable: true,
            comment: 'Additional data associated with the notification'
          },
          {
            name: 'scheduled_for',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When the notification should be sent (null for immediate)'
          },
          {
            name: 'sent_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'delivered_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'read_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'expires_at',
            type: 'timestamp with time zone',
            isNullable: true,
            comment: 'When the notification expires and can be cleaned up'
          },
          {
            name: 'retry_count',
            type: 'integer',
            isNullable: false,
            default: 0
          },
          {
            name: 'max_retries',
            type: 'integer',
            isNullable: false,
            default: 3
          },
          {
            name: 'last_retry_at',
            type: 'timestamp with time zone',
            isNullable: true
          },
          {
            name: 'error_message',
            type: 'text',
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

    // Create foreign key constraint
    await queryRunner.createForeignKey(
      'notifications',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE'
      })
    );

    // Create indexes for better performance
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_user_id',
      columnNames: ['user_id']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_type',
      columnNames: ['type']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_status',
      columnNames: ['status']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_channel',
      columnNames: ['channel']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_user_status',
      columnNames: ['user_id', 'status']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_user_type',
      columnNames: ['user_id', 'type']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_scheduled_for',
      columnNames: ['scheduled_for']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_expires_at',
      columnNames: ['expires_at']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_pending_scheduled',
      columnNames: ['status', 'scheduled_for']
    }));
    
    await queryRunner.createIndex('notifications', new TableIndex({
      name: 'IDX_notifications_created_at',
      columnNames: ['created_at']
    }));

    // Create updated_at trigger
    await queryRunner.query(`
      CREATE TRIGGER update_notifications_updated_at
        BEFORE UPDATE ON notifications
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Add constraint to ensure retry_count doesn't exceed max_retries
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT chk_notifications_retry_count
      CHECK (retry_count <= max_retries);
    `);

    // Add constraint to ensure max_retries is non-negative
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT chk_notifications_max_retries
      CHECK (max_retries >= 0);
    `);

    // Add constraint to ensure scheduled_for is in the future when status is pending
    await queryRunner.query(`
      ALTER TABLE notifications
      ADD CONSTRAINT chk_notifications_scheduled_future
      CHECK (
        (status != 'pending' AND scheduled_for IS NULL) OR
        (status = 'pending' AND (scheduled_for IS NULL OR scheduled_for > created_at))
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_notifications_updated_at ON notifications`);
    await queryRunner.dropTable('notifications');
  }
}