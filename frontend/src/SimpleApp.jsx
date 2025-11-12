import React, { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import SimpleIntegrations from './SimpleIntegrations'

function LoginScreen() {
  const { login } = useAuth()
  const [email, setEmail] = useState('seller@test.com')
  const [password, setPassword] = useState('password123')
  const [message, setMessage] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (!result.success) {
      setMessage('❌ ' + (result.error || 'Ошибка входа'))
    }
  }

  return (
    <div style={{ background: '#121212', color: '#00FFFF', minHeight: '100vh', padding: '50px', fontFamily: 'monospace' }}>
      <h1>MINIMALMOD - LOGIN</h1>
      <form onSubmit={handleLogin} style={{ marginTop: '30px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label>Email:</label><br/>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '10px', width: '300px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label>Password:</label><br/>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', width: '300px', marginTop: '5px' }}
          />
        </div>
        <button type="submit" style={{ padding: '10px 30px', cursor: 'pointer' }}>
          ВОЙТИ
        </button>
      </form>
      {message && <p style={{ marginTop: '20px', color: '#FF4500' }}>{message}</p>}
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ background: '#121212', color: '#00FFFF', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace' }}>
        <p>LOADING...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginScreen />
  }

  return <SimpleIntegrations />
}

function SimpleApp() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default SimpleApp
