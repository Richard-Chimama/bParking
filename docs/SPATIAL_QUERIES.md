# Spatial Queries for Parking Locations

This document describes the spatial query functionality implemented for the bParking application, enabling location-based parking searches and mapping features.

## Overview

The application uses PostgreSQL with PostGIS extension to store and query parking location coordinates. This enables powerful spatial queries for finding nearby parking locations and filtering by geographic areas.

## Database Schema

### Parking Entity Spatial Fields

```typescript
@Entity('parkings')
export class Parking {
  // Spatial location using PostGIS Point geometry
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326, // WGS84 coordinate system
  })
  location!: Point;

  // Address information for display
  @Column({ type: 'jsonb' })
  address!: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  // Spatial index for performance
  @Index(['location'], { spatial: true })
}
```

### GraphQL Types

```typescript
@ObjectType()
class ParkingAddressType {
  @Field()
  street!: string;

  @Field()
  city!: string;

  @Field()
  state!: string;

  @Field()
  zipCode!: string;

  @Field()
  country!: string;
}

@ObjectType()
class ParkingType {
  @Field()
  id!: string;

  @Field()
  name!: string;

  @Field()
  description!: string;

  @Field()
  totalSpaces!: number;

  @Field()
  availableSpaces!: number;

  @Field(() => [Number])
  coordinates!: number[];

  @Field(() => ParkingAddressType)
  address!: ParkingAddressType;
}
```

## GraphQL Queries

### 1. Get All Parking Locations
```graphql
query {
  parkings {
    id
    name
    description
    totalSpaces
    availableSpaces
    coordinates
    address {
      street
      city
      state
      zipCode
      country
    }
  }
}
```

### 2. Get Single Parking Location
```graphql
query {
  parking(id: "parking-uuid") {
    id
    name
    description
    totalSpaces
    availableSpaces
    coordinates
    address {
      street
      city
      state
      zipCode
      country
    }
  }
}
```

### 3. Find Nearby Parking Locations
```graphql
query {
  nearbyParkings(
    latitude: -15.3875
    longitude: 28.3228
    maxDistance: 10000
  ) {
    id
    name
    description
    totalSpaces
    availableSpaces
    coordinates
    address {
      street
      city
      state
      zipCode
      country
    }
  }
}
```

### 4. Find Parking by City
```graphql
query {
  parkingsByCity(city: "Lusaka") {
    id
    name
    description
    totalSpaces
    availableSpaces
    coordinates
    address {
      street
      city
      state
      zipCode
      country
    }
  }
}
```

## Spatial Query Methods

### 1. findNearby(coordinates, maxDistance)

Finds parking locations within a specified distance from given coordinates.

```typescript
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
```

**Parameters:**
- `coordinates`: `[longitude, latitude]` array
- `maxDistance`: Distance in meters (default: 10,000m = 10km)

**Returns:** Array of parking locations ordered by distance

### 2. findByCity(city)

Finds parking locations in a specific city using case-insensitive search.

```typescript
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
```

**Parameters:**
- `city`: City name (case-insensitive partial match)

**Returns:** Array of parking locations in the specified city

## Coordinate System

- **SRID**: 4326 (WGS84)
- **Format**: `[longitude, latitude]` array
- **Example**: `[28.3228, -15.3875]` for Lusaka, Zambia

## Performance Optimizations

1. **Spatial Index**: The `location` column has a spatial index for fast distance queries
2. **Composite Indexes**: Additional indexes on `isActive`, `isVerified`, and `createdAt`
3. **Query Optimization**: Uses PostGIS spatial functions for efficient distance calculations

## Usage Examples

### Frontend Map Integration

```javascript
// Get user's current location
navigator.geolocation.getCurrentPosition(async (position) => {
  const { latitude, longitude } = position.coords;
  
  // Find nearby parking
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          nearbyParkings(
            latitude: ${latitude}
            longitude: ${longitude}
            maxDistance: 5000
          ) {
            id
            name
            coordinates
            availableSpaces
          }
        }
      `
    })
  });
  
  const data = await response.json();
  // Add markers to map
  data.data.nearbyParkings.forEach(parking => {
    addMarkerToMap(parking.coordinates, parking.name);
  });
});
```

### City-Based Search

```javascript
// Search for parking in a specific city
const searchParkingByCity = async (cityName) => {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query {
          parkingsByCity(city: "${cityName}") {
            id
            name
            coordinates
            address {
              street
              city
            }
          }
        }
      `
    })
  });
  
  return await response.json();
};
```

## Testing

Run the spatial query tests:

```bash
npm test src/test/spatial-querys.test.ts
```

## Requirements

- PostgreSQL with PostGIS extension
- TypeORM with spatial support
- Proper database indexes for performance

## Future Enhancements

1. **Polygon Search**: Search within custom geographic boundaries
2. **Route-Based Search**: Find parking along a route
3. **Real-time Availability**: Live updates of parking availability
4. **Geofencing**: Notifications when entering parking areas
5. **Heat Maps**: Visual representation of parking density 