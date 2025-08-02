import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { storage } from "./storage";
import passport from "passport";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { client } from "./replit-client";

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export async function setupAuth(app: Express) {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  if (!process.env.REPLIT_DOMAINS) {
    throw new Error("Environment variable REPLIT_DOMAINS not provided");
  }

  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: "sessions",
  });

  app.use(session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: 'lax', // Allow cookies to be sent with same-site requests
    },
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new passport.Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    // Use the first domain from REPLIT_DOMAINS for localhost development
    const domain = req.hostname === 'localhost' ? 
      process.env.REPLIT_DOMAINS!.split(",")[0] : 
      req.hostname;
    
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    // Use the first domain from REPLIT_DOMAINS for localhost development
    const domain = req.hostname === 'localhost' ? 
      process.env.REPLIT_DOMAINS!.split(",")[0] : 
      req.hostname;
      
    passport.authenticate(`replitauth:${domain}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(claims: any) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.NODE_ENV === "development") {
    return next();
  }

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  const user = req.user as any;
  if (!user?.expires_at || user.expires_at * 1000 < Date.now()) {
    try {
      const config = await getOidcConfig();
      const tokens = await client.refresh(config, user.refresh_token);
      updateUserSession(user, tokens);
      await upsertUser(user.claims);
    } catch (error) {
      console.error("Error refreshing token:", error);
      return res.status(401).json({ message: "Session expired" });
    }
  }

  next();
};