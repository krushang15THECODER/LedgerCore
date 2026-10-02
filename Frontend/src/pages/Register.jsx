import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/register', formData);
      if (response.data.success) {
        navigate('/login');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-primary)', padding: 'var(--spacing-8) 0' }}>
      <div style={{ width: '100%', maxWidth: '440px', zIndex: 1 }} className="animate-reveal-down">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 'var(--spacing-8)' }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>LEDGERCORE</h1>
          <div className="lc-identifier">AUTH / REGISTER</div>
        </div>
        
        <div className="surface">
          <span className="meta-label">Account Registration</span>
          <hr className="hr-structural" style={{ margin: 'var(--spacing-4) 0' }} />
          
          {error && (
            <div className="text-negative font-mono" style={{ marginBottom: 'var(--spacing-6)' }}>
              ERR: {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-6)' }}>
            <div>
              <label className="meta-label">Full Name</label>
              <input name="name" type="text" className="input-field" value={formData.name} onChange={handleChange} required />
            </div>
            <div>
              <label className="meta-label">Email</label>
              <input name="email" type="email" className="input-field font-mono" value={formData.email} onChange={handleChange} required />
            </div>
            <div>
              <label className="meta-label">Phone Number (Optional)</label>
              <input name="phone" type="tel" className="input-field font-mono" value={formData.phone} onChange={handleChange} />
            </div>
            <div>
              <label className="meta-label">Password</label>
              <input name="password" type="password" className="input-field" value={formData.password} onChange={handleChange} required minLength={6} />
            </div>
            
            <button type="submit" className="btn-primary" style={{ marginTop: 'var(--spacing-4)' }}>
              Create Account
            </button>
          </form>
        </div>

        <div style={{ marginTop: 'var(--spacing-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="meta-label" style={{ margin: 0 }}>Already have an account?</span>
          <Link to="/login" className="font-mono text-muted" style={{ textDecoration: 'underline' }}>SIGN IN</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
