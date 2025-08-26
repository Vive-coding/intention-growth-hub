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

// Initialize Redis for rate limiting (only if REDIS_URL is provided)
let redis: Redis | null = null;

if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL);
    console.log('Redis connected successfully');
  } catch (error) {
    console.warn('Redis connection failed, rate limiting disabled:', error);
    redis = null;
  }
} else if (process.env.NODE_ENV === 'production') {
  console.log('No REDIS_URL provided, rate limiting disabled');
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

  // Content Filtering - AI-powered context-aware analysis
  static async filterInappropriateContent(text: string): Promise<{
    isAppropriate: boolean;
    reason?: string;
    reasonCode?: 'profanity' | 'sexual_content' | 'hate' | 'violence' | 'threat' | 'racism' | 'slur' | 'other';
    offendingTerms?: string[];
    confidence?: number;
  }> {
    try {
      // Skip AI analysis for very short text to avoid false positives
      if (text.trim().length < 10) {
        return { isAppropriate: true };
      }

      // Use OpenAI to analyze content with context awareness
      const { ChatOpenAI } = await import('langchain/chat_models/openai');
      const { PromptTemplate } = await import('langchain/prompts');
      const { StringOutputParser } = await import('langchain/schema/output_parser');

      const model = new ChatOpenAI({
        modelName: 'gpt-4o-mini',
        temperature: 0.1,
        maxTokens: 200,
      });

      const prompt = PromptTemplate.fromTemplate(`
You are a content safety analyst. Analyze the following text and determine if it contains inappropriate content.

IMPORTANT CONTEXT:
- This is a personal journal entry for self-reflection and growth
- Legitimate emotional expression (e.g., "I hate feeling sad", "I'm working through anger") is APPROPRIATE
- Discussion of difficult topics for therapeutic purposes is APPROPRIATE
- Only flag content that is genuinely harmful, threatening, or inappropriate

TEXT TO ANALYZE:
{text}

ANALYSIS INSTRUCTIONS:
1. Consider the context and intent of the text
2. Distinguish between:
   - Legitimate emotional expression (APPROPRIATE)
   - Therapeutic discussion of difficult topics (APPROPRIATE)
   - Actual harmful content (INAPPROPRIATE)
3. Be conservative - only flag if clearly inappropriate

RESPOND IN THIS EXACT JSON FORMAT:
{
  "isAppropriate": boolean,
  "reason": "string explaining why",
  "reasonCode": "profanity|sexual_content|hate|violence|threat|racism|slur|other|null",
  "offendingTerms": ["array of specific terms if any"],
  "confidence": number (0-100)
}

Examples of APPROPRIATE content:
- "I hate feeling anxious about work"
- "I'm working through my anger issues"
- "The violence in the news affects my mental health"
- "I need to address my racist thoughts and biases"

Examples of INAPPROPRIATE content:
- "I want to hurt someone"
- "I hate [specific group of people]"
- "Let's plan violence against [target]"
`);

      const chain = prompt.pipe(model).pipe(new StringOutputParser());
      
      const result = await chain.invoke({ text });
      
      try {
        const analysis = JSON.parse(result);
        
        // Validate the response structure
        if (typeof analysis.isAppropriate === 'boolean') {
          return {
            isAppropriate: analysis.isAppropriate,
            reason: analysis.reason || undefined,
            reasonCode: analysis.reasonCode || undefined,
            offendingTerms: Array.isArray(analysis.offendingTerms) ? analysis.offendingTerms : undefined,
            confidence: typeof analysis.confidence === 'number' ? analysis.confidence : undefined,
          };
        }
      } catch (parseError) {
        console.error('Failed to parse AI analysis:', parseError);
      }

      // Fallback to basic safety check if AI fails
      return this.fallbackContentCheck(text);
      
    } catch (error) {
      console.error('AI content analysis failed, falling back to basic check:', error);
      return this.fallbackContentCheck(text);
    }
  }

  // Fallback content check - more conservative than the old system
  private static fallbackContentCheck(text: string): {
    isAppropriate: boolean;
    reason?: string;
    reasonCode?: 'profanity' | 'sexual_content' | 'hate' | 'violence' | 'threat' | 'racism' | 'slur' | 'other';
    offendingTerms?: string[];
  } {
    // Only flag extremely obvious harmful content
    const harmfulPatterns = [
      { pattern: /\b(i\s+want\s+to\s+hurt\b|\bkill\b|\battack\b)/i, code: 'violence' as const, reason: 'Contains violent intent' },
      { pattern: /\b(i\s+hate\s+all?\s+\[?\w+\]?s?\b)/i, code: 'hate' as const, reason: 'Contains hate speech targeting groups' },
      { pattern: /\b(threaten\b|\bintimidate\b)/i, code: 'threat' as const, reason: 'Contains threatening language' },
    ];

    const lowerText = text.toLowerCase();
    
    for (const { pattern, code, reason } of harmfulPatterns) {
      if (pattern.test(lowerText)) {
        return {
          isAppropriate: false,
          reason,
          reasonCode: code,
          offendingTerms: [lowerText.match(pattern)?.[0] || ''],
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
    // For development mode, check if dev auth is disabled
    if (process.env.NODE_ENV === 'development') {
      // If dev auth is disabled, require proper authentication
      // This will be checked by the authMiddleware
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