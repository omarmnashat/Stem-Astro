import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './hooks/useApp.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { initMusic } from './services/musicService.js';
import { initUiSounds } from './services/soundService.js';
import './styles/index.css';

initMusic();
initUiSounds();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <App />
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
