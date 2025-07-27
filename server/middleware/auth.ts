import { Request, Response, NextFunction } from 'express';
import { verifyToken, verifyGuestToken, generateGuestToken } from '../mongodb';

// Extend the Express Request interface to include user and guest properties
declare global {
	namespace Express {
		interface Request {
			user?: {
				userId: string;
				email: string;
			};
			guest?: {
				guestId: string;
				isGuest: boolean;
			};
		}
	}
}

// Authentication middleware - protects routes
export const authenticate = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
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
			email: decoded.email,
		};

		next();
	} catch (error) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
};

// Optional authentication middleware - doesn't block unauthenticated requests
export const optionalAuth = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
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
			email: decoded.email,
		};
	} catch (error) {
		// Continue without setting user if token is invalid
	}

	next();
};

// Guest authentication middleware - creates or validates guest session
export const createGuestAuth = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// Check if user is already authenticated
	if (req.user) {
		return next();
	}

	// Look for existing guest token in cookies
	const guestToken = req.cookies?.guestToken;

	if (guestToken) {
		try {
			// Verify existing guest token
			const decoded = verifyGuestToken(guestToken);
			req.guest = {
				guestId: decoded.guestId,
				isGuest: decoded.isGuest,
			};
			return next();
		} catch (error) {
			// Guest token is invalid, will create new one below
		}
	}

	// Create new guest token
	const newGuestToken = generateGuestToken();

	try {
		const decoded = verifyGuestToken(newGuestToken);
		req.guest = {
			guestId: decoded.guestId,
			isGuest: decoded.isGuest,
		};

		// Set HTTP-only cookie with guest token (24h expiration)
		res.cookie('guestToken', newGuestToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'strict',
			maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
		});

		next();
	} catch (error) {
		return res
			.status(500)
			.json({ message: 'Failed to create guest session' });
	}
};

// Combined authentication middleware - supports both user and guest auth
export const optionalUserOrGuest = (
	req: Request,
	res: Response,
	next: NextFunction
) => {
	// First try user authentication
	const authHeader = req.headers.authorization;

	if (authHeader && authHeader.startsWith('Bearer ')) {
		const token = authHeader.split(' ')[1];

		try {
			const decoded = verifyToken(token);
			req.user = {
				userId: decoded.userId,
				email: decoded.email,
			};
			return next();
		} catch (error) {
			// Fall through to guest authentication
		}
	}

	// Try guest authentication
	createGuestAuth(req, res, next);
};
