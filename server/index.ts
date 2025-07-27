// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';

const app = express();

// Security: Rate limiting to prevent DoS attacks
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 100, // limit each IP to 100 requests per windowMs
	message: {
		error: 'Too many requests from this IP, please try again later.',
	},
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Security: Apply rate limiting to all API routes
app.use('/api/', limiter);

// Security: Add comprehensive security headers with helmet
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: [
					"'self'",
					"'unsafe-inline'",
					'https://fonts.googleapis.com',
				],
				fontSrc: ["'self'", 'https://fonts.gstatic.com'],
				imgSrc: ["'self'", 'data:', 'https:'],
				scriptSrc: ["'self'", "'unsafe-inline'"],
				connectSrc: [
					"'self'",
					'https://places.googleapis.com',
					'https://api.openai.com',
				],
			},
		},
		crossOriginEmbedderPolicy: false, // Allow embedding for development
	})
);

// Security: CORS configuration
const corsOptions = {
	origin: function (
		origin: string | undefined,
		callback: (err: Error | null, allow?: boolean) => void
	) {
		const allowedOrigins =
			process.env.NODE_ENV === 'production'
				? [process.env.CLIENT_URL || 'https://yourdomain.com']
				: [
						'http://localhost:3000',
						'http://localhost:3001',
						'http://localhost:5173',
				  ];

		// Allow requests with no origin (like mobile apps or curl requests)
		if (!origin) return callback(null, true);

		if (allowedOrigins.includes(origin)) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'), false);
		}
	},
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));

// Parse cookies for guest authentication
app.use(cookieParser());

// Security: Add request size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// API request logging middleware
app.use((req, res, next) => {
	const start = Date.now();
	const path = req.path;
	let capturedJsonResponse: Record<string, any> | undefined = undefined;

	const originalResJson = res.json;
	res.json = function (bodyJson, ...args) {
		capturedJsonResponse = bodyJson;
		return originalResJson.apply(res, [bodyJson, ...args]);
	};

	res.on('finish', () => {
		const duration = Date.now() - start;
		if (path.startsWith('/api')) {
			let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
			if (capturedJsonResponse) {
				logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
			}

			if (logLine.length > 80) {
				logLine = logLine.slice(0, 79) + '…';
			}

			log(logLine);
		}
	});

	next();
});

(async () => {
	const server = await registerRoutes(app);

	// Security: Improved error handling that doesn't leak information
	app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
		const status = err.status || err.statusCode || 500;
		const message = err.message || 'Internal Server Error';

		// Log full error details for debugging (server-side only)
		console.error('Error:', err);

		// Only send generic error message to client for server errors
		if (status >= 500) {
			res.status(status).json({ message: 'Internal Server Error' });
		} else {
			res.status(status).json({ message });
		}
	});

	// importantly only setup vite in development and after
	// setting up all the other routes so the catch-all route
	// doesn't interfere with the other routes
	if (app.get('env') === 'development') {
		await setupVite(app, server);
	} else {
		serveStatic(app);
	}

	// ALWAYS serve the app on port 3000
	// Port 5000 conflicts with macOS Control Center
	const port = 3000;
	server.listen(
		{
			port,
			host: '127.0.0.1',
		},
		() => {
			log(`serving on port ${port}`);
		}
	);
})();
