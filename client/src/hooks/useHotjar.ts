import { useEffect } from 'react';
import { useLocation } from 'wouter';

// Declare global hj function with full interface
declare global {
	interface Window {
		hj?: {
			(command: 'vpv', path?: string): void;
			(
				command: 'identify',
				userId: string,
				userProperties?: object
			): void;
			(command: 'event', eventName: string): void;
			(command: string, ...args: any[]): void;
			q?: any[];
		};
		_hjSettings?: {
			hjid: number;
			hjsv: number;
			hjdebug?: boolean;
		};
	}
}

export function useHotjar() {
	const [location] = useLocation();

	useEffect(() => {
		// Enhanced Hotjar detection and virtual page view
		const triggerPageView = () => {
			if (typeof window === 'undefined') return;

			// Check if Hotjar is loaded
			if (window.hj && typeof window.hj === 'function') {
				console.log(
					'🔥 Hotjar: Triggering virtual page view for:',
					location
				);
				window.hj('vpv', location);
				return true;
			}

			// Check if Hotjar settings exist (script loaded but not ready)
			if (window._hjSettings) {
				console.log('🔥 Hotjar: Settings found, retrying page view...');
				setTimeout(triggerPageView, 200);
				return false;
			}

			console.log('🔥 Hotjar: Not detected yet, retrying...');
			return false;
		};

		// Initial trigger with retries
		let retries = 0;
		const maxRetries = 20; // 4 seconds total

		const retryPageView = () => {
			if (triggerPageView() || retries >= maxRetries) {
				return;
			}
			retries++;
			setTimeout(retryPageView, 200);
		};

		retryPageView();
	}, [location]);

	// One-time initialization check
	useEffect(() => {
		const checkHotjarSetup = () => {
			if (typeof window === 'undefined') return;

			console.log('🔥 Hotjar Debug Info:');
			console.log('- window.hj exists:', !!window.hj);
			console.log('- window._hjSettings:', window._hjSettings);
			console.log(
				'- Script in page:',
				!!document.querySelector('script[src*="hotjar"]')
			);

			if (window.hj) {
				console.log('✅ Hotjar is loaded and ready!');
			} else if (window._hjSettings) {
				console.log(
					'⏳ Hotjar settings found, script may still be loading...'
				);
			} else {
				console.log('❌ Hotjar not detected');
			}
		};

		// Check immediately and after a delay
		checkHotjarSetup();
		setTimeout(checkHotjarSetup, 2000);
	}, []);
}
