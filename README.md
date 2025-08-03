# bParking Backend

A secure and scalable parking application backend built with Node.js, Express, GraphQL, TypeScript, and MongoDB. This application allows users to find parking spaces, make payments using Zambian mobile money, and manage parking operations.

## 🚀 Features

- **User Authentication**: Phone number and password-based authentication with OTP verification
- **Parking Management**: Create, manage, and search for parking spaces
- **Payment Integration**: Support for Zambian mobile money payments
- **Google Maps Integration**: Location-based parking search
- **Admin Dashboard**: Comprehensive admin panel for managing users and parking spaces
- **Real-time Updates**: Live parking availability updates
- **Security**: JWT authentication, rate limiting, and input validation
- **GraphQL API**: Modern, type-safe API with Apollo Server

## 🛠 Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **API**: GraphQL with Apollo Server
- **Language**: TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with bcrypt
- **SMS**: Twilio for OTP delivery
- **Maps**: Google Maps API
- **Payments**: Zambian Mobile Money integration
- **Cloud**: AWS (S3, deployment)
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 13+
- Redis (optional, for caching)
- npm or yarn

## 🚀 Quick Start

### 1. Clone the repository

```bash
git clone <repository-url>
cd bParking
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Setup

Copy the environment template and configure your variables:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=4000
API_URL=http://localhost:4000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=bparking

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Twilio Configuration (SMS OTP)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Payment Configuration
ZAMBIA_MOBILE_MONEY_API_KEY=your-zambian-mobile-money-api-key
ZAMBIA_MOBILE_MONEY_SECRET=your-zambian-mobile-money-secret
```

### 4. Start the development server

```bash
npm run dev
```

The server will start on `http://localhost:4000`

- **GraphQL Playground**: http://localhost:4000/graphql
- **Health Check**: http://localhost:4000/health
- **pgAdmin**: http://localhost:8081 (admin@bparking.com / admin123)

## 📚 API Documentation

### GraphQL Endpoint

The main API endpoint is available at `/graphql` with the following operations:

#### Authentication

```graphql
# Register a new user
mutation Register($input: RegisterInput!) {
  register(input: $input) {
    success
    message
    user {
      id
      firstName
      lastName
      email
      phoneNumber
      isVerified
    }
  }
}

# Login user
mutation Login($input: LoginInput!) {
  login(input: $input) {
    success
    message
    token
    user {
      id
      firstName
      lastName
      email
      phoneNumber
      role
      isVerified
    }
  }
}

# Verify OTP
mutation VerifyOTP($input: VerifyOTPInput!) {
  verifyOTP(input: $input) {
    success
    message
    token
    user {
      id
      isVerified
    }
  }
}
```

#### Parking Operations

```graphql
# Get all parking spaces
query GetParkings {
  parkings {
    id
    name
    description
    totalSpaces
    availableSpaces
  }
}

# Get specific parking
query GetParking($id: String!) {
  parking(id: $id) {
    id
    name
    description
    totalSpaces
    availableSpaces
  }
}

# Create parking (requires authentication)
mutation CreateParking($input: CreateParkingInput!) {
  createParking(input: $input) {
    success
    message
  }
}
```

#### Payment Operations

```graphql
# Create payment
mutation CreatePayment($input: CreatePaymentInput!) {
  createPayment(input: $input) {
    success
    message
    transactionId
  }
}

# Verify payment
mutation VerifyPayment($transactionId: String!) {
  verifyPayment(transactionId: $transactionId) {
    success
    message
  }
}
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage
```

## 🏗 Project Structure

```
src/
├── config/           # Configuration files
├── database/         # Database connection and setup
├── graphql/          # GraphQL resolvers and schema
│   └── resolvers/    # GraphQL resolvers
├── middleware/       # Express middleware
├── models/           # Mongoose models
├── services/         # Business logic services
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── index.ts          # Application entry point
```

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Database
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed database with sample data

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
```

## 🔐 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with configurable rounds
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input validation and sanitization
- **CORS Protection**: Configurable CORS settings
- **Helmet**: Security headers middleware
- **Account Locking**: Automatic account locking after failed attempts

## 📱 Mobile Money Integration

The application supports Zambian mobile money providers:

- **MTN Mobile Money**
- **Airtel Money**
- **Zamtel Kwacha**

Payment flow:
1. User initiates payment
2. System generates payment request
3. User receives payment prompt
4. Payment verification
5. Booking confirmation

## 🗺 Google Maps Integration

- **Geolocation**: Find parking spaces near user location
- **Distance Calculation**: Calculate distance to parking spaces
- **Address Geocoding**: Convert addresses to coordinates
- **Reverse Geocoding**: Convert coordinates to addresses

## 🚀 Deployment

### AWS Deployment

1. **EC2 Setup**:
   ```bash
   # Install Node.js and PM2
   curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   npm install -g pm2
   ```

2. **Environment Configuration**:
   ```bash
   # Set production environment variables
   export NODE_ENV=production
   export MONGODB_URI=mongodb://your-production-mongodb-uri
   ```

3. **Deploy with PM2**:
   ```bash
   npm run build
   pm2 start dist/index.js --name "bparking-backend"
   pm2 startup
   pm2 save
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 4000

CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- **Email**: support@bparking.com
- **Documentation**: [API Docs](https://docs.bparking.com)
- **Issues**: [GitHub Issues](https://github.com/bparking/backend/issues)

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release
- User authentication with OTP
- Parking space management
- Payment integration
- Admin dashboard
- GraphQL API

---

**Built with ❤️ for the Zambian parking community** 