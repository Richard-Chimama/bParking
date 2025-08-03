import { AppDataSource } from '@/database/connection';
import { Parking } from '@/entities/Parking';
import { User } from '@/entities/User';

describe('Seed Data Tests', () => {
  beforeAll(async () => {
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  describe('Database Seeding', () => {
    it('should have users in the database', async () => {
      const userRepository = AppDataSource.getRepository(User);
      const users = await userRepository.find();
      
      expect(users.length).toBeGreaterThan(0);
      
      // Check for specific users
      const adminUser = users.find(user => user.role === 'admin');
      const ownerUser = users.find(user => user.role === 'owner');
      
      expect(adminUser).toBeDefined();
      expect(ownerUser).toBeDefined();
      expect(adminUser?.email).toBe('admin@bparking.com');
      expect(ownerUser?.email).toBe('owner@bparking.com');
    });

    it('should have parking locations in the database', async () => {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parkings = await parkingRepository.find();
      
      expect(parkings.length).toBeGreaterThan(0);
      
      // Check for specific parking locations
      const lusakaParking = parkings.find(p => p.address.city === 'Lusaka');
      const kitweParking = parkings.find(p => p.address.city === 'Kitwe');
      
      expect(lusakaParking).toBeDefined();
      expect(kitweParking).toBeDefined();
    });

    it('should have parking locations with valid coordinates', async () => {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parkings = await parkingRepository.find();
      
      parkings.forEach(parking => {
        expect(parking.location).toBeDefined();
        expect(parking.location.coordinates).toBeDefined();
        expect(parking.location.coordinates).toHaveLength(2);
        expect(typeof parking.location.coordinates[0]).toBe('number');
        expect(typeof parking.location.coordinates[1]).toBe('number');
      });
    });
  });

  describe('Spatial Queries with Seed Data', () => {
    it('should find nearby parking in Lusaka', async () => {
      // Lusaka coordinates
      const lusakaCoords: [number, number] = [28.3228, -15.3875];
      const maxDistance = 10000; // 10km
      
      const nearbyParkings = await Parking.findNearby(lusakaCoords, maxDistance);
      
      expect(nearbyParkings.length).toBeGreaterThan(0);
      
      // Should find Lusaka parking locations
      const lusakaParkings = nearbyParkings.filter(p => p.address.city === 'Lusaka');
      expect(lusakaParkings.length).toBeGreaterThan(0);
    });

    it('should find parking by city', async () => {
      const lusakaParkings = await Parking.findByCity('Lusaka');
      
      expect(lusakaParkings.length).toBeGreaterThan(0);
      
      lusakaParkings.forEach(parking => {
        expect(parking.address.city.toLowerCase()).toContain('lusaka');
      });
    });

    it('should find parking in different cities', async () => {
      const cities = ['Lusaka', 'Kitwe', 'Ndola', 'Livingstone'];
      
      for (const city of cities) {
        const parkings = await Parking.findByCity(city);
        expect(parkings.length).toBeGreaterThan(0);
        
        parkings.forEach(parking => {
          expect(parking.address.city.toLowerCase()).toContain(city.toLowerCase());
        });
      }
    });
  });

  describe('Parking Data Structure', () => {
    it('should have valid parking space data', async () => {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parkings = await parkingRepository.find();
      
      parkings.forEach(parking => {
        expect(parking.parkingSpaces).toBeDefined();
        expect(Array.isArray(parking.parkingSpaces)).toBe(true);
        expect(parking.parkingSpaces.length).toBe(parking.totalSpaces);
        
        // Check available spaces calculation
        const availableSpaces = parking.parkingSpaces.filter(space => space.isAvailable).length;
        expect(availableSpaces).toBe(parking.availableSpaces);
      });
    });

    it('should have valid pricing information', async () => {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parkings = await parkingRepository.find();
      
      parkings.forEach(parking => {
        expect(parking.pricing).toBeDefined();
        expect(parking.pricing.hourly).toBeGreaterThan(0);
        expect(parking.pricing.daily).toBeGreaterThan(0);
        expect(parking.pricing.currency).toBe('ZMW');
      });
    });

    it('should have valid operating hours', async () => {
      const parkingRepository = AppDataSource.getRepository(Parking);
      const parkings = await parkingRepository.find();
      
      parkings.forEach(parking => {
        expect(parking.operatingHours).toBeDefined();
        expect(parking.operatingHours.monday).toBeDefined();
        expect(parking.operatingHours.monday.isOpen).toBeDefined();
        expect(parking.operatingHours.monday.open).toBeDefined();
        expect(parking.operatingHours.monday.close).toBeDefined();
      });
    });
  });
}); 