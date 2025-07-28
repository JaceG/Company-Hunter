import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import Hotjar from '@hotjar/browser';

// Initialize Hotjar
const siteId = 6476685;
const hotjarVersion = 6;

Hotjar.init(siteId, hotjarVersion);

createRoot(document.getElementById('root')!).render(<App />);
