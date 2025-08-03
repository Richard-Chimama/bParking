// GraphQL Types
export interface AddressType {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  }
  
  export interface PreferencesType {
    notifications: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
  }
  
  export interface UserType {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    role: string;
    isVerified: boolean;
    isActive: boolean;
    profilePicture?: string;
    dateOfBirth?: Date;
    address?: AddressType;
    preferences?: PreferencesType;
    lastLoginAt?: Date;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface Context {
    user?: {
      id: string;
      email: string;
      phoneNumber: string;
      role: string;
      isVerified: boolean;
    };
  }