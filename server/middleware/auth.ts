import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../mongodb';

// Extend the Express Request interface to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
      };
    }
  }
}

// Authentication middleware
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract and verify token
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    // Add user info to request
    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Optional authentication middleware
// This will add user info to req.user if token is valid,
// but will not block the request if token is missing/invalid
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract and verify token
      const token = authHeader.split(' ')[1];
      try {
        const decoded = verifyToken(token);
        
        // Add user info to request
        req.user = {
          userId: decoded.userId,
          email: decoded.email
        };
      } catch (error) {
        // Ignore token errors in optional auth
        console.log('Invalid token in optional auth');
      }
    }
    
    next();
  } catch (error) {
    // Continue without user info
    next();
  }
};