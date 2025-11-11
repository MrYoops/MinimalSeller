import React, { useState } from 'react'
import axios from 'axios'

function SimpleApp() {
  const [email, setEmail] = useState('seller@test.com')
  const [password, setPassword] = useState('password123')
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)

  const API_URL = ''

  const api = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' }
  })

  api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  })

  const handleLogin = async (e) => {
    e.preventDefault()
    try {
      const response = await api.post('/api/auth/login', { email, password })
      localStorage.setItem('token', response.data.access_token)
      setUser(response.data.user)
      setMessage('✅ Вход выполнен!')
    } catch (error) {
      setMessage('❌ Ошибка входа: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setMessage('Вы вышли из системы')
  }

  if (user) {
    return (
      <div style={{ background: '#121212', color: '#00FFFF', minHeight: '100vh', padding: '50px', fontFamily: 'monospace' }}>
        <h1>✅ MINIMALMOD - PREVIEW РАБОТАЕТ!</h1>
        <p>Привет, {user.full_name}!</p>
        <p>Email: {user.email}</p>
        <p>Role: {user.role}</p>
        <button onClick={handleLogout} style={{ padding: '10px 20px', marginTop: '20px', cursor: 'pointer' }}>
          Выйти
        </button>
      </div>
    )
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
      {message && <p style={{ marginTop: '20px', color: message.includes('✅') ? '#00FF7F' : '#FF4500' }}>{message}</p>}
    </div>
  )
}

export default SimpleApp
