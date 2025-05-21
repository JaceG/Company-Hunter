import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../mongodb';

// Extend the Express Request interface to include a user property
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

// Authentication middleware - protects routes
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    // Check if token exists
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    try {
        // Verify token
        const decoded = verifyToken(token);
        
        // Add user data to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
        
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

// Optional authentication middleware - doesn't block unauthenticated requests
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    // If no token, continue without setting user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    try {
        // Verify token
        const decoded = verifyToken(token);
        
        // Add user data to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email
        };
    } catch (error) {
        // Continue without setting user if token is invalid
    }
    
    next();
};