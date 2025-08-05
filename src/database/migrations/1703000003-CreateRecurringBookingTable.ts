import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateRecurringBookingTable1703000003 implements MigrationInterface {
  name = 'CreateRecurringBookingTable1703000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'recurring_bookings',
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
            name: 'recurrence_pattern',
            type: 'enum',
            enum: ['daily', 'weekly', 'monthly', 'custom'],
            isNullable: false
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'paused', 'cancelled', 'completed'],
            default: "'active'"
          },
          {
            name: 'start_time',
            type: 'varchar',
            length: '5',
            isNullable: false,
            comment: 'Time in HH:MM format'
          },
          {
            name: 'end_time',
            type: 'varchar',
            length: '5',
            isNullable: false,
            comment: 'Time in HH:MM format'
          },
          {
            name: 'duration',
            type: 'decimal',
            precision: 4,
            scale: 2,
            isNullable: false,
            comment: 'Duration in hours'
          },
          {
            name: 'start_date',
            type: 'date',
            isNullable: false
          },
          {
            name: 'end_date',
            type: 'date',
            isNullable: true
          },
          {
            name: 'next_booking_date',
            type: 'date',
            isNullable: false
          },
          {
            name: 'max_occurrences',
            type: 'integer',
            isNullable: true
          },
          {
            name: 'custom_pattern',
            type: 'jsonb',
            isNullable: true,
            comment: 'Custom recurrence pattern configuration'
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
            name: 'base_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
            isNullable: false
          },
          {
            name: 'currency',
            type: 'varchar',
            length: '3',
            isNullable: false,
            default: "'ZMW'"
          },
          {
            name: 'auto_payment',
            type: 'boolean',
            isNullable: false,
            default: false
          },
          {
            name: 'payment_method_id',
            type: 'varchar',
            length: '255',
            isNullable: true
          },
          {
            name: 'booking_history',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'",
            comment: 'History of created bookings'
          },
          {
            name: 'failure_history',
            type: 'jsonb',
            isNullable: true,
            default: "'[]'",
            comment: 'History of failed booking attempts'
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
      'recurring_bookings',
      new TableForeignKey({
        columnNames: ['user_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE'
      })
    );

    await queryRunner.createForeignKey(
      'recurring_bookings',
      new TableForeignKey({
        columnNames: ['parking_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'parkings',
        onDelete: 'CASCADE'
      })
    );

    // Create indexes for better performance
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_user_id',
      columnNames: ['user_id']
    }));
    
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_parking_id',
      columnNames: ['parking_id']
    }));
    
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_status',
      columnNames: ['status']
    }));
    
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_next_booking_date',
      columnNames: ['next_booking_date']
    }));
    
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_status_next_date',
      columnNames: ['status', 'next_booking_date']
    }));
    
    await queryRunner.createIndex('recurring_bookings', new TableIndex({
      name: 'IDX_recurring_bookings_pattern',
      columnNames: ['recurrence_pattern']
    }));

    // Create updated_at trigger
    await queryRunner.query(`
      CREATE TRIGGER update_recurring_bookings_updated_at
        BEFORE UPDATE ON recurring_bookings
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `);

    // Add constraint to ensure start_time is before end_time
    await queryRunner.query(`
      ALTER TABLE recurring_bookings
      ADD CONSTRAINT chk_recurring_bookings_time_order
      CHECK (start_time < end_time);
    `);

    // Add constraint to ensure start_date is before end_date (if end_date is provided)
    await queryRunner.query(`
      ALTER TABLE recurring_bookings
      ADD CONSTRAINT chk_recurring_bookings_date_order
      CHECK (end_date IS NULL OR start_date <= end_date);
    `);

    // Add constraint to ensure duration is positive
    await queryRunner.query(`
      ALTER TABLE recurring_bookings
      ADD CONSTRAINT chk_recurring_bookings_positive_duration
      CHECK (duration > 0);
    `);

    // Add constraint to ensure base_price is non-negative
    await queryRunner.query(`
      ALTER TABLE recurring_bookings
      ADD CONSTRAINT chk_recurring_bookings_non_negative_price
      CHECK (base_price >= 0);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_recurring_bookings_updated_at ON recurring_bookings`);
    await queryRunner.dropTable('recurring_bookings');
  }
}