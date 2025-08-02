import { NlpManager } from 'node-nlp';
import crypto from 'crypto';
import Redis from 'ioredis';

// Initialize NLP manager for PII detection
const nlpManager = new NlpManager({ languages: ['en'] });

// Add PII patterns
nlpManager.addNamedEntityText('email', 'email', ['en'], ['@gmail.com', '@yahoo.com', '@hotmail.com']);
nlpManager.addNamedEntityText('phone', 'phone', ['en'], ['phone', 'mobile', 'cell']);
nlpManager.addNamedEntityText('address', 'address', ['en'], ['street', 'avenue', 'road', 'lane']);
nlpManager.addNamedEntityText('ssn', 'ssn', ['en'], ['ssn', 'social security']);
nlpManager.addNamedEntityText('credit_card', 'credit_card', ['en'], ['credit card', 'visa', 'mastercard']);

// Initialize Redis for rate limiting (only in production)
let redis: Redis | null = null;

if (process.env.NODE_ENV === 'production') {
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
}

// Encryption key management
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32);
const IV_LENGTH = 16;

// Initialize security components
export async function initializeSecurity(): Promise<void> {
  await nlpManager.train();
}

interface Entity {
  entity: string;
  sourceText: string;
}

export class SecurityManager {
  // PII Detection
  static async detectPII(text: string): Promise<{
    hasPII: boolean;
    detectedEntities: { entity: string; text: string }[];
  }> {
    try {
      const result = await nlpManager.process(text);
      const detectedEntities = result.entities.map((e: Entity) => ({
        entity: e.entity,
        text: e.sourceText
      }));

      return {
        hasPII: detectedEntities.length > 0,
        detectedEntities
      };
    } catch (error) {
      console.error('Error detecting PII:', error);
      return { hasPII: false, detectedEntities: [] };
    }
  }

  // Content Filtering
  static async filterInappropriateContent(text: string): Promise<{
    isAppropriate: boolean;
    reason?: string;
  }> {
    // List of inappropriate terms (expand as needed)
    const inappropriateTerms = [
      'hate', 'slur', 'racist', 'violence', 'threat',
      // Add more terms as needed
    ];

    const lowerText = text.toLowerCase();
    for (const term of inappropriateTerms) {
      if (lowerText.includes(term)) {
        return {
          isAppropriate: false,
          reason: `Contains inappropriate term: ${term}`
        };
      }
    }

    return { isAppropriate: true };
  }

  // Rate Limiting
  static async checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number): Promise<boolean> {
    // Skip rate limiting in development mode
    if (!redis || process.env.NODE_ENV === 'development') {
      return true;
    }
    
    const key = `ratelimit:${userId}:${action}`;
    const count = await redis.incr(key);
    
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    return count <= limit;
  }

  // Encryption
  static encrypt(text: string): { encryptedData: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encryptedData: encrypted,
      iv: iv.toString('hex')
    };
  }

  // Decryption
  static decrypt(encryptedData: string, iv: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(iv, 'hex')
    );
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Access Control
  static async checkAccess(userId: string, resourceId: string, action: 'read' | 'write' | 'delete'): Promise<boolean> {
    // For development mode, allow all access
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    // For production, implement proper ownership checks
    // TODO: Implement database lookup to verify resource ownership
    // For now, return true to allow access
    return true;
  }

  // Mask PII in text
  static async maskPII(text: string): Promise<string> {
    const { detectedEntities } = await this.detectPII(text);
    let maskedText = text;

    for (const entity of detectedEntities) {
      maskedText = maskedText.replace(entity.text, `[REDACTED ${entity.entity}]`);
    }

    return maskedText;
  }
}

// Export individual functions for convenience
export const {
  detectPII,
  filterInappropriateContent,
  checkRateLimit,
  encrypt,
  decrypt,
  checkAccess,
  maskPII
} = SecurityManager; 