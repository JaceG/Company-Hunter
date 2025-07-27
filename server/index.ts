import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';

const app = express();

// Security: Add request size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security: Basic CORS configuration
app.use((req, res, next) => {
	// Allow requests from development and production origins
	const allowedOrigins =
		process.env.NODE_ENV === 'production'
			? [process.env.CLIENT_URL || 'https://yourdomain.com']
			: [
					'http://localhost:3000',
					'http://localhost:5000',
					'http://localhost:5173',
			  ];

	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin || '')) {
		res.setHeader('Access-Control-Allow-Origin', origin || '*');
	}

	res.setHeader(
		'Access-Control-Allow-Methods',
		'GET, POST, PUT, DELETE, PATCH, OPTIONS'
	);
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Content-Type, Authorization'
	);
	res.setHeader('Access-Control-Allow-Credentials', 'true');

	// Handle preflight requests
	if (req.method === 'OPTIONS') {
		res.sendStatus(200);
		return;
	}

	next();
});

// Security: Basic security headers
app.use((req, res, next) => {
	res.setHeader('X-Content-Type-Options', 'nosniff');
	res.setHeader('X-Frame-Options', 'DENY');
	res.setHeader('X-XSS-Protection', '1; mode=block');
	res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

	// Only set HSTS in production with HTTPS
	if (process.env.NODE_ENV === 'production') {
		res.setHeader(
			'Strict-Transport-Security',
			'max-age=31536000; includeSubDomains'
		);
	}

	next();
});

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

		// Only send generic error message to client
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

	// ALWAYS serve the app on port 5000
	// this serves both the API and the client.
	// It is the only port that is not firewalled.
	const port = 5000;
	server.listen(
		{
			port,
			host: '0.0.0.0',
			reusePort: true,
		},
		() => {
			log(`serving on port ${port}`);
		}
	);
})();
