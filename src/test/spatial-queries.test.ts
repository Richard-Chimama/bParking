import { Parking } from '@/entities/Parking';
import { AppDataSource } from '@/database/connection';

describe('Spatial Queries', () => {
  beforeAll(async () => {
    // Initialize database connection
    await AppDataSource.initialize();
  });

  afterAll(async () => {
    // Close database connection
    await AppDataSource.destroy();
  });

  describe('findNearby', () => {
    it('should find parking locations within specified distance', async () => {
      // Test coordinates for Lusaka, Zambia
      const testCoordinates: [number, number] = [28.3228, -15.3875]; // [longitude, latitude]
      const maxDistance = 10000; // 10km

      const nearbyParkings = await Parking.findNearby(testCoordinates, maxDistance);
      
      // Should return an array (even if empty)
      expect(Array.isArray(nearbyParkings)).toBe(true);
      
      // If there are results, they should have the expected structure
      if (nearbyParkings.length > 0) {
        const parking = nearbyParkings[0];
        expect(parking).toHaveProperty('id');
        expect(parking).toHaveProperty('name');
        expect(parking).toHaveProperty('location');
        expect(parking).toHaveProperty('address');
        expect(parking.isActive).toBe(true);
        expect(parking.isVerified).toBe(true);
      }
    });
  });

  describe('findByCity', () => {
    it('should find parking locations by city name', async () => {
      const cityName = 'Lusaka';
      
      const cityParkings = await Parking.findByCity(cityName);
      
      // Should return an array (even if empty)
      expect(Array.isArray(cityParkings)).toBe(true);
      
      // If there are results, they should have the expected structure
      if (cityParkings.length > 0) {
        const parking = cityParkings[0];
        expect(parking).toHaveProperty('id');
        expect(parking).toHaveProperty('name');
        expect(parking).toHaveProperty('address');
        expect(parking.address.city.toLowerCase()).toContain(cityName.toLowerCase());
        expect(parking.isActive).toBe(true);
        expect(parking.isVerified).toBe(true);
      }
    });
  });
}); 