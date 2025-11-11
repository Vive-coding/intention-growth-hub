// Load environment variables first
import * as dotenv from 'dotenv';

// Only load .env file in development, not in production (Railway)
if (process.env.NODE_ENV !== 'production') {
  const result = dotenv.config();
  if (result.error) {
    console.error('Error loading .env file:', result.error);
    process.exit(1);
  }
}

console.log('Loaded environment variables:', {
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { ensureUsersTimezoneColumn, ensureFeedbackTables, ensureChatTables, ensureNotificationTables, ensureOnboardingProfileColumns } from "./db";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CORS middleware to allow requests from Vercel frontend
app.use((req, res, next) => {
  // Allow multiple origins for development and different environments
  const allowedOrigins = [
    'https://goodhabit.ai',
    'https://intention-growth-hub.vercel.app',
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000'  // Local development
  ];
  
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // In development, allow any origin
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Best-effort ensure schema compatibility without destructive migrations
  await ensureUsersTimezoneColumn();
  await ensureFeedbackTables();
  try { await ensureChatTables(); } catch (e) { console.warn('ensureChatTables failed', e); }
  try { await ensureNotificationTables(); } catch (e) { console.warn('ensureNotificationTables failed', e); }
  try { await ensureOnboardingProfileColumns(); } catch (e) { console.warn('ensureOnboardingProfileColumns failed', e); }
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT) || 3000;
  // Use localhost for development on macOS, 0.0.0.0 for production
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
  server.listen(port, host, () => {
    log(`serving on port ${port} (host: ${host})`);
  });
})();
