import { Request, Response, NextFunction } from 'express';
import { SecurityManager } from '../ai/security';

export async function securityMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.claims?.sub;
    
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Rate limiting
    const isWithinLimit = await SecurityManager.checkRateLimit(
      userId,
      req.method + req.path,
      Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
      Number(process.env.RATE_LIMIT_WINDOW) || 3600
    );

    if (!isWithinLimit) {
      return res.status(429).json({ message: 'Rate limit exceeded' });
    }

    // Access control for specific resources
    if (req.params.id) {
      const canAccess = await SecurityManager.checkAccess(
        userId,
        req.params.id,
        req.method.toLowerCase() as 'read' | 'write' | 'delete'
      );

      if (!canAccess) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // For POST/PUT requests, check content
    if (['POST', 'PUT'].includes(req.method) && req.body) {
      const content = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      
      // Content filtering
      const contentResult = await SecurityManager.filterInappropriateContent(content);
      if (!contentResult.isAppropriate) {
        return res.status(400).json({
          message: 'Inappropriate content detected',
          reason: contentResult.reason
        });
      }

      // PII detection and masking
      const piiResult = await SecurityManager.detectPII(content);
      if (piiResult.hasPII) {
        // Log PII detection but don't block the request
        console.warn('PII detected in request:', {
          userId,
          method: req.method,
          path: req.path,
          entities: piiResult.detectedEntities.map(e => e.entity)
        });

        // Mask PII in the request body
        if (typeof req.body === 'string') {
          req.body = await SecurityManager.maskPII(req.body);
        } else {
          const maskedContent = await SecurityManager.maskPII(content);
          req.body = JSON.parse(maskedContent);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Security middleware error:', error);
    res.status(500).json({ message: 'Internal security error' });
  }
} 