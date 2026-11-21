import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles.css';
import { AuthProvider } from './auth';
import { FeedbackTab, Header } from './components/Header';
import { Home } from './pages/Home';
import { Resources } from './pages/Resources';
import { Connections } from './pages/Connections';
import { CasePage, OrderPage, ServicePage } from './pages/Details';

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/connections" element={<Connections />} />
        <Route path="/connections/orders/:id" element={<OrderPage />} />
        <Route path="/connections/services/:id" element={<ServicePage />} />
        <Route path="/connections/cases/:id" element={<CasePage />} />
        <Route path="/resources" element={<Resources />} />
        {/* Quotes screens not designed yet: send to the home page for now */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <FeedbackTab />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
