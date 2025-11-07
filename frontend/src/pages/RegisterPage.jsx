import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    company_name: '',
    inn: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await register(formData)
    
    if (result.success) {
      setSuccess(result.message)
      setTimeout(() => navigate('/login'), 3000)
    } else {
      setError(result.error)
    }
    
    setLoading(false)
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen bg-mm-black flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-mm-text">
            MINIMAL<span className="text-mm-purple">MOD</span>
          </h1>
          <p className="comment">// Seller Registration</p>
        </div>

        {/* Register Form */}
        <div className="card-neon">
          <h2 className="text-2xl mb-2 text-mm-cyan">REGISTER</h2>
          <p className="comment mb-8">// Create your seller account</p>

          {error && (
            <div className="mb-6 p-4 border border-mm-red bg-mm-red/10 text-mm-red text-sm font-mono">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 border border-mm-green bg-mm-green/10 text-mm-green text-sm font-mono">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Full Name *
                </label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="input-neon w-full"
                  placeholder="Ivan Petrov"
                  required
                  data-testid="register-fullname-input"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input-neon w-full"
                  placeholder="seller@example.com"
                  required
                  data-testid="register-email-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                Password *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input-neon w-full"
                placeholder="••••••••"
                required
                minLength={6}
                data-testid="register-password-input"
              />
              <p className="comment text-xs mt-1">// Minimum 6 characters</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  Company Name
                </label>
                <input
                  type="text"
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  className="input-neon w-full"
                  placeholder="LLC MinimalSeller"
                  data-testid="register-company-input"
                />
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                  INN
                </label>
                <input
                  type="text"
                  name="inn"
                  value={formData.inn}
                  onChange={handleChange}
                  className="input-neon w-full"
                  placeholder="1234567890"
                  data-testid="register-inn-input"
                />
                <p className="comment text-xs mt-1">// Tax identification number</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="register-submit-button"
            >
              {loading ? '// PROCESSING...' : '// REGISTER'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-mm-border">
            <p className="text-mm-text-secondary text-sm text-center">
              <span className="comment">// Already registered?</span>{' '}
              <Link to="/login" className="text-mm-cyan hover:text-mm-cyan/80 transition-colors">
                Login here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-mm-yellow/10 border border-mm-yellow">
            <p className="text-mm-yellow text-xs font-mono">
              ⚠ Your account will require admin approval before activation
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage