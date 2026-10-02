import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/');
      } else {
        setError('Authentication failed. Check credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'System error during authentication.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
      <div style={{ width: '100%', maxWidth: '440px', zIndex: 1 }} className="animate-reveal-down">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-8)' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>LEDGERCORE</h1>
          <div className="lc-identifier">AUTH / LOGIN</div>
        </div>
        
        <div className="surface">
          <span className="meta-label">Secure Login</span>
          <hr className="hr-structural" style={{ margin: 'var(--spacing-4) 0' }} />
          
          {error && (
            <div className="text-negative font-mono" style={{ marginBottom: 'var(--spacing-6)' }}>
              ERR: {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
            <div>
              <label className="meta-label">Email</label>
              <input 
                type="email" 
                className="input-field font-mono" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div>
              <label className="meta-label">Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            
            <button type="submit" className="btn-primary" style={{ marginTop: 'var(--spacing-4)' }}>
              Sign In
            </button>
          </form>
        </div>

        <div style={{ marginTop: 'var(--spacing-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta-label" style={{ margin: 0 }}>Don't have an account?</span>
          <Link to="/register" className="font-mono text-muted" style={{ textDecoration: 'underline' }}>REGISTER NOW</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
