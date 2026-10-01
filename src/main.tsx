import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/transactions.css';
import './styles/dashboard.css';
import './styles/budgets.css';
import './styles/features.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
