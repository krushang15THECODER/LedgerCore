import React, { useState, useContext } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Header = () => {
  const { user, logout } = useContext(AuthContext);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navLinkStyle = ({ isActive }) => ({
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    borderBottom: isActive ? '1px solid var(--color-text-primary)' : '1px solid transparent',
    paddingBottom: 'var(--spacing-1)',
    transition: 'all var(--transition-fast)'
  });

  return (
    <header className="header-container">
      {/* Desktop & Mobile Top Bar */}
      <div className="header-top-bar">
        {/* Left: Brand Identity */}
        <div className="header-brand">
          <div className="lc-identifier" style={{ marginRight: 'var(--spacing-6)' }}>LC / 01</div>
          <h1 className="header-title">LEDGERCORE</h1>
        </div>
        
        {/* Center: Desktop Navigation */}
        <nav className="header-desktop-nav">
          <NavLink to="/" style={navLinkStyle} end>OVERVIEW</NavLink>
          <NavLink to="/accounts" style={navLinkStyle}>ACCOUNTS</NavLink>
          <NavLink to="/transactions" style={navLinkStyle}>TRANSACTIONS</NavLink>
        </nav>
        
        {/* Right: System Area */}
        <div className="header-system-area">
          <div className="system-status">
            <span className="status-dot"></span> SYSTEM / ONLINE
          </div>
          <div className="user-info">
            <span className="font-mono">{user?.name}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            LOGOUT
          </button>
        </div>

        {/* Mobile Menu Toggle Button */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? 'CLOSE' : 'MENU'}
        </button>
      </div>

      {/* Mobile Navigation Menu */}
      <div className={`mobile-menu ${isMobileMenuOpen ? 'open' : ''}`}>
        <nav className="mobile-nav-links">
          <NavLink to="/" style={navLinkStyle} onClick={() => setIsMobileMenuOpen(false)} end>OVERVIEW</NavLink>
          <NavLink to="/accounts" style={navLinkStyle} onClick={() => setIsMobileMenuOpen(false)}>ACCOUNTS</NavLink>
          <NavLink to="/transactions" style={navLinkStyle} onClick={() => setIsMobileMenuOpen(false)}>TRANSACTIONS</NavLink>
          <hr className="hr-structural" style={{ margin: 'var(--spacing-4) 0' }} />
          <div className="meta-label">USER: {user?.name}</div>
          <button onClick={handleLogout} style={{ ...navLinkStyle({ isActive: false }), textAlign: 'left', marginTop: 'var(--spacing-2)', color: 'var(--color-negative)' }}>
            LOGOUT
          </button>
        </nav>
      </div>
    </header>
  );
};

export default Header;
