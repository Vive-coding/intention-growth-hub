import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './services/analyticsService' // Initialize analytics

createRoot(document.getElementById("root")!).render(<App />);
