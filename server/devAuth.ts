import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "./auth";

export const setupDevAuth = (app: any) => {
  // No setup needed for dev auth
  return Promise.resolve();
};

export const isDevAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Always require proper authentication - no dev bypass
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  console.log(`Auth middleware: ${req.method} ${req.path} - Token: ${token ? 'present' : 'missing'}`);
  
  if (!token) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ message: "No token provided" });
  }
  
  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      console.log('Auth middleware: Invalid token');
      return res.status(401).json({ message: "Invalid token" });
    }
    
    console.log(`Auth middleware: Valid token for user ${decoded.userId}`);
    
    // Add the real user to the request with proper ID - make it consistent
    (req as any).user = {
      id: decoded.userId, // Set the actual user ID
      claims: {
        sub: decoded.userId,
      }
    };
    next();
  } catch (error) {
    console.log('Auth middleware: Token verification error:', error);
    return res.status(401).json({ message: "Invalid token" });
  }
}; 