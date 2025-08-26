import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface User {
  id: string;
  email: string | null;
  password: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  onboardingCompleted: boolean | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): { userId: string } | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch (error) {
    return null;
  }
};

export const createUser = async (email: string, password: string, firstName: string, lastName: string): Promise<User> => {
  const hashedPassword = await hashPassword(password);
  
  const user = await storage.createUser({
    email,
    password: hashedPassword,
    firstName,
    lastName,
    profileImageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(firstName + ' ' + lastName)}&background=random`,
    onboardingCompleted: false,
  });
  
  return user;
};

export const authenticateUser = async (email: string, password: string): Promise<User | null> => {
  const user = await storage.getUserByEmail(email);
  if (!user || !user.password) return null;
  
  const isValid = await comparePassword(password, user.password);
  if (!isValid) return null;
  
  return user;
}; 