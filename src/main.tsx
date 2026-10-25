import './styles/globals.css';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

if (import.meta.env.DEV) setInterval(() => performance.clearMeasures(), 5000);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
