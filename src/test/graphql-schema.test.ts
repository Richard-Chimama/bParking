import { buildSchema } from 'type-graphql';
import { ParkingResolver } from '@/graphql/resolvers/ParkingResolver';
import { UserResolver } from '@/graphql/resolvers/UserResolver';
import { AdminResolver } from '@/graphql/resolvers/AdminResolver';
import { PaymentResolver } from '@/graphql/resolvers/PaymentResolver';
import { BookingResolver } from '@/graphql/resolvers/BookingResolver';

describe('GraphQL Schema', () => {
  it('should build schema without naming conflicts', async () => {
    try {
      const schema = await buildSchema({
        resolvers: [
          ParkingResolver,
          UserResolver,
          AdminResolver,
          PaymentResolver,
          BookingResolver,
        ],
        validate: false,
      });
      
      // If we get here, the schema built successfully
      expect(schema).toBeDefined();
      
      // Check that our parking queries are available
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();
      
      const fields = queryType!.getFields();
      expect(fields.parkings).toBeDefined();
      expect(fields.parking).toBeDefined();
      expect(fields.nearbyParkings).toBeDefined();
      expect(fields.parkingsByCity).toBeDefined();
      
    } catch (error) {
      fail(`Schema build failed: ${error}`);
    }
  });

  it('should have correct parking type structure', async () => {
    const schema = await buildSchema({
      resolvers: [
        ParkingResolver,
        UserResolver,
        AdminResolver,
        PaymentResolver,
      ],
      validate: false,
    });

    const parkingType = schema.getType('ParkingType');
    expect(parkingType).toBeDefined();

    const fields = (parkingType as any).getFields();
    expect(fields.id).toBeDefined();
    expect(fields.name).toBeDefined();
    expect(fields.coordinates).toBeDefined();
    expect(fields.address).toBeDefined();
  });
});