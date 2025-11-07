import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/translations'

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const { language } = useTheme()
  const { t } = useTranslation(language)
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(formData.email, formData.password)
    
    if (result.success) {
      navigate('/')
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
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-mm-text">
            MINIMAL<span className="text-mm-purple">MOD</span>
          </h1>
          <p className="comment">{t('noDistractionsJustResults')}</p>
        </div>

        {/* Login Form */}
        <div className="card-neon">
          <h2 className="text-2xl mb-2 text-mm-cyan">{t('login')}</h2>
          <p className="comment mb-8">{t('enterCredentials')}</p>

          {error && (
            <div className="mb-6 p-4 border border-mm-red bg-mm-red/10 text-mm-red text-sm font-mono">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                {t('email')}
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input-neon w-full"
                placeholder="admin@minimalmod.com"
                required
                data-testid="login-email-input"
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase tracking-wider">
                {t('password')}
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="input-neon w-full"
                placeholder="••••••••"
                required
                data-testid="login-password-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="login-submit-button"
            >
              {loading ? t('loading') : `// ${t('login')}`}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-mm-border">
            <p className="text-mm-text-secondary text-sm text-center">
              <span className="comment">// New seller?</span>{' '}
              <Link to="/register" className="text-mm-cyan hover:text-mm-cyan/80 transition-colors">
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-mm-darker border border-mm-border">
            <p className="comment text-xs mb-2">// Demo credentials:</p>
            <p className="text-xs text-mm-text-secondary">
              Admin: admin@minimalmod.com / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage