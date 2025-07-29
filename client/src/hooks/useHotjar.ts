import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Declare global hj function
declare global {
	interface Window {
		hj?: (command: string, ...args: any[]) => void;
	}
}

export function useHotjar() {
	const [location] = useLocation();

	useEffect(() => {
		// Wait for Hotjar to be loaded
		const checkHotjar = () => {
			if (typeof window !== 'undefined' && window.hj) {
				// Virtual page view for SPA route changes
				window.hj('vpv', location);
				console.log('Hotjar virtual page view:', location);
			} else {
				// Retry after a short delay if Hotjar isn't loaded yet
				setTimeout(checkHotjar, 100);
			}
		};

		checkHotjar();
	}, [location]);
}
