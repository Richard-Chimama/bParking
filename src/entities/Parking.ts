import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  Index,
} from 'typeorm';
import { Point } from 'geojson';
import { User } from './User';
import { AppDataSource } from '@/database/connection';

@Entity('parkings')
@Index(['location'], { spatial: true })
@Index(['owner'])
@Index(['isActive'])
@Index(['isVerified'])
@Index(['rating'])
@Index(['createdAt'])
export class Parking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb' })
  address!: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  location!: Point;

  @Column()
  totalSpaces!: number;

  @Column()
  availableSpaces!: number;

  @Column({ type: 'jsonb' })
  parkingSpaces!: {
    id: string;
    number: string;
    isAvailable: boolean;
    isReserved: boolean;
    currentBooking?: string;
    lastUpdated: Date;
  }[];

  @Column({ type: 'jsonb' })
  pricing!: {
    hourly: number;
    daily: number;
    weekly: number;
    monthly: number;
    currency: string;
  };

  @Column({ type: 'text', array: true, default: [] })
  amenities!: string[];

  @Column({ type: 'text', array: true, default: [] })
  images!: string[];

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isVerified!: boolean;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner!: User;

  @Column()
  ownerId!: string;

  @Column({ type: 'jsonb' })
  operatingHours!: {
    monday: { open: string; close: string; isOpen: boolean };
    tuesday: { open: string; close: string; isOpen: boolean };
    wednesday: { open: string; close: string; isOpen: boolean };
    thursday: { open: string; close: string; isOpen: boolean };
    friday: { open: string; close: string; isOpen: boolean };
    saturday: { open: string; close: string; isOpen: boolean };
    sunday: { open: string; close: string; isOpen: boolean };
  };

  @Column({ type: 'text', array: true, default: [] })
  rules!: string[];

  @Column({ type: 'jsonb' })
  contactInfo!: {
    phone: string;
    email: string;
  };

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating!: number;

  @Column({ default: 0 })
  totalReviews!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Virtual property for full address
  get fullAddress(): string {
    return `${this.address.street}, ${this.address.city}, ${this.address.state} ${this.address.zipCode}, ${this.address.country}`;
  }

  // Update available spaces before insert/update
  @BeforeInsert()
  @BeforeUpdate()
  updateAvailableSpaces() {
    if (this.parkingSpaces) {
      this.availableSpaces = this.parkingSpaces.filter(space => space.isAvailable).length;
    }
  }

  // Static methods
  static async findNearby(coordinates: [number, number], maxDistance: number = 10000) {
    const parkingRepository = AppDataSource.getRepository(Parking);
    
    return await parkingRepository
      .createQueryBuilder('parking')
      .where('ST_DWithin(parking.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326), :distance)')
      .andWhere('parking.isActive = :isActive')
      .andWhere('parking.isVerified = :isVerified')
      .setParameters({
        lng: coordinates[0],
        lat: coordinates[1],
        distance: maxDistance,
        isActive: true,
        isVerified: true
      })
      .orderBy('ST_Distance(parking.location, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326))')
      .getMany();
  }

  static async findByCity(city: string) {
    const parkingRepository = AppDataSource.getRepository(Parking);
    
    return await parkingRepository
      .createQueryBuilder('parking')
      .where("parking.address->>'city' ILIKE :city")
      .andWhere('parking.isActive = :isActive')
      .andWhere('parking.isVerified = :isVerified')
      .setParameters({
        city: `%${city}%`,
        isActive: true,
        isVerified: true
      })
      .orderBy('parking.name')
      .getMany();
  }
} 