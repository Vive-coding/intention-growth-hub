import type { Request, Response, NextFunction } from "express";

export const setupDevAuth = (app: any) => {
  // No setup needed for dev auth
  return Promise.resolve();
};

export const isDevAuthenticated = (req: Request, _res: Response, next: NextFunction) => {
  // Add a mock user for development
  (req as any).user = {
    claims: {
      sub: "dev-user-123",
      name: "Development User",
      email: "dev@example.com"
    }
  };
  next();
}; 