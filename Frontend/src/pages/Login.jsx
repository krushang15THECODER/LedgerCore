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
        setError('Login failed. Check your credentials.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred during login.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)' }}>
      <div className="surface" style={{ width: '100%', maxWidth: '400px' }}>
        <h1 style={{ textAlign: 'center', marginBottom: 'var(--spacing-6)' }}>LedgerCore</h1>
        
        {error && (
          <div style={{ color: 'var(--color-negative)', marginBottom: 'var(--spacing-4)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Email</label>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 'var(--spacing-2)', fontSize: '0.875rem', fontWeight: 500 }}>Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ marginTop: 'var(--spacing-2)' }}>
            Sign In
          </button>
        </form>

        <div style={{ marginTop: 'var(--spacing-6)', textAlign: 'center', fontSize: '0.875rem' }}>
          Don't have an account? <Link to="/register" style={{ fontWeight: 500, textDecoration: 'underline' }}>Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
