import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

const AppLayout = () => {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <div style={{ flex: 1, display: 'flex' }}>
        {/* Structural Vertical Label - Only visible on larger screens */}
        <div style={{ padding: 'var(--spacing-8) var(--spacing-4)', display: 'flex', borderRight: '1px solid var(--color-divider)' }} className="hide-on-mobile">
          <div className="vertical-label">FINANCIAL LEDGER SYSTEM</div>
        </div>

        <main className="container" style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
