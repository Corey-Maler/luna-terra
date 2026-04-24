import { StrictMode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import { FpsProvider } from './context/FpsContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <StrictMode>
    <BrowserRouter>
      <FpsProvider>
        <App />
      </FpsProvider>
    </BrowserRouter>
  </StrictMode>
);
