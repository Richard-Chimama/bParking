# Database Seeding Guide

This guide explains how to populate your bParking database with sample data for testing and development.

## Overview

The seeding system creates realistic sample data including:
- **Users** (regular users, admin, parking owners)
- **Parking Locations** across major Zambian cities
- **Spatial Data** with real coordinates for mapping
- **Complete Parking Information** (spaces, pricing, hours, etc.)

## Quick Start

### 1. Run the Seeding Script

```bash
# Development mode (recommended)
npm run db:seed:dev

# Production mode (requires build)
npm run db:seed

# Fresh seeding (clears existing data)
npm run db:seed:fresh
```

### 2. Verify the Data

After seeding, you can test the data with GraphQL queries:

```graphql
# Get all parking locations
query {
  parkings {
    id
    name
    coordinates
    address { city }
    availableSpaces
  }
}

# Find nearby parking in Lusaka
query {
  nearbyParkings(
    latitude: -15.3875
    longitude: 28.3228
    maxDistance: 10000
  ) {
    id
    name
    coordinates
    address { city }
  }
}
```

## Sample Data Created

### Users

| Name | Email | Phone | Role | Password |
|------|-------|-------|------|----------|
| John Doe | john.doe@example.com | +260977123456 | user | password123 |
| Jane Smith | jane.smith@example.com | +260977123457 | user | password123 |
| Admin User | admin@bparking.com | +260977123458 | admin | admin123 |
| Parking Owner | owner@bparking.com | +260977123459 | owner | owner123 |

### Parking Locations

#### 1. Lusaka Central Parking
- **Location**: Cairo Road, Lusaka
- **Coordinates**: [28.3228, -15.3875]
- **Spaces**: 50 total, 35 available
- **Pricing**: 5 ZMW/hour, 50 ZMW/day
- **Features**: Security, CCTV, Well Lit

#### 2. Manda Hill Shopping Centre Parking
- **Location**: Great East Road, Lusaka
- **Coordinates**: [28.3456, -15.3987]
- **Spaces**: 200 total, 150 available
- **Pricing**: 3 ZMW/hour, 30 ZMW/day
- **Features**: Shopping Centre Access, Family Friendly

#### 3. Kitwe City Centre Parking
- **Location**: President Avenue, Kitwe
- **Coordinates**: [28.2345, -12.8234]
- **Spaces**: 80 total, 60 available
- **Pricing**: 4 ZMW/hour, 40 ZMW/day
- **Features**: Near Banks, Government Access

#### 4. Ndola Airport Parking
- **Location**: Airport Road, Ndola
- **Coordinates**: [28.6789, -12.9987]
- **Spaces**: 120 total, 90 available
- **Pricing**: 8 ZMW/hour, 80 ZMW/day
- **Features**: Airport Shuttle, 24/7 Access

#### 5. Livingstone Tourist Parking
- **Location**: Mosi-oa-Tunya Road, Livingstone
- **Coordinates**: [25.8567, -17.8577]
- **Spaces**: 100 total, 75 available
- **Pricing**: 6 ZMW/hour, 60 ZMW/day
- **Features**: Tourist Information, Near Attractions

## Testing Spatial Queries

### Find Nearby Parking

```typescript
// Lusaka coordinates
const lusakaCoords: [number, number] = [28.3228, -15.3875];
const nearbyParkings = await Parking.findNearby(lusakaCoords, 10000);
// Returns: Lusaka Central Parking, Manda Hill Parking
```

### Find by City

```typescript
const lusakaParkings = await Parking.findByCity('Lusaka');
// Returns: All parking locations in Lusaka
```

### GraphQL Queries

```graphql
# Test nearby parking
query {
  nearbyParkings(
    latitude: -15.3875
    longitude: 28.3228
    maxDistance: 5000
  ) {
    id
    name
    coordinates
    address { city }
    availableSpaces
  }
}

# Test city search
query {
  parkingsByCity(city: "Lusaka") {
    id
    name
    coordinates
    address { city }
    totalSpaces
    availableSpaces
  }
}
```

## Running Tests

Test the seed data with the provided test suite:

```bash
# Run all tests
npm test

# Run specific seed tests
npm test -- --testNamePattern="Seed Data Tests"
```

## Customizing Seed Data

### Adding New Users

Edit `src/database/seeds/seedData.ts`:

```typescript
const usersData = [
  // ... existing users
  {
    firstName: 'New',
    lastName: 'User',
    email: 'newuser@example.com',
    phoneNumber: '+260977123465',
    password: 'password123',
    role: 'user',
    isVerified: true,
    isActive: true,
  },
];
```

### Adding New Parking Locations

```typescript
const parkingData = [
  // ... existing parking
  {
    name: 'New Parking Location',
    description: 'Description here',
    address: {
      street: 'Street Name',
      city: 'City Name',
      state: 'Province',
      zipCode: '12345',
      country: 'Zambia',
    },
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    } as Point,
    // ... other fields
  },
];
```

## Data Structure

### Parking Spaces

Each parking location includes detailed space information:

```typescript
parkingSpaces: [
  {
    id: 'space-1',
    number: 'A01',
    isAvailable: true,
    isReserved: false,
    lastUpdated: new Date(),
  },
  // ... more spaces
]
```

### Pricing Structure

```typescript
pricing: {
  hourly: 5,      // ZMW per hour
  daily: 50,      // ZMW per day
  weekly: 250,    // ZMW per week
  monthly: 800,   // ZMW per month
  currency: 'ZMW',
}
```

### Operating Hours

```typescript
operatingHours: {
  monday: { open: '06:00', close: '22:00', isOpen: true },
  tuesday: { open: '06:00', close: '22:00', isOpen: true },
  // ... other days
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Ensure database is running
   # Check connection settings in .env
   ```

2. **Permission Errors**
   ```bash
   # Ensure database user has write permissions
   ```

3. **Duplicate Data**
   ```bash
   # The seeding script clears existing data by default
   # Comment out the clear() calls if you want to keep existing data
   ```

### Reset Database

```bash
# Drop and recreate database
npm run db:migrate:revert
npm run db:migrate
npm run db:seed:dev
```

## Production Considerations

- **Never run seeding in production** without careful review
- **Use environment-specific data** for different deployments
- **Backup existing data** before seeding
- **Test thoroughly** before deploying seed data changes

## Next Steps

After seeding, you can:

1. **Test the GraphQL API** with the sample data
2. **Verify spatial queries** work correctly
3. **Test authentication** with the sample users
4. **Build frontend features** using the realistic data
5. **Add more locations** as needed for your use case 