import React, { useContext } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import { LogOut, LayoutDashboard } from 'lucide-react';

const AppLayout = () => {
  const { user, logout } = useContext(AuthContext);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--spacing-4) var(--spacing-8)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>LedgerCore</h1>
          <nav style={{ display: 'flex', gap: 'var(--spacing-4)', marginLeft: 'var(--spacing-8)' }}>
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
              <LayoutDashboard size={18} /> Dashboard
            </Link>
          </nav>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-4)' }}>
          <span style={{ color: 'var(--color-text-secondary)' }}>
            {user?.name}
          </span>
          <button 
            onClick={logout}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem',
              color: 'var(--color-negative)'
            }}
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <main className="container" style={{ flex: 1, width: '100%' }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
