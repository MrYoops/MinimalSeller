import React, { createContext, useState, useContext, useEffect } from 'react'
import axios from 'axios'

const AuthContext = createContext()

// Backend URL - используем прокси через Vite, с fallback на прямой URL
function getBackendURL() {
  const hostname = window.location.hostname
  
  // Если мы на localhost или 127.0.0.1, используем прокси
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    console.log('🔧 Using proxy for localhost')
    return ''  // Пустая строка для использования прокси
  }
  
  // Для всех остальных случаев используем прямой URL
  console.log('🔧 Using direct URL for:', hostname)
  return 'http://localhost:8001'
}

const API_URL = getBackendURL()

console.log('🔧 Backend URL:', API_URL, '| Hostname:', window.location.hostname)

const api = axios.create({
  baseURL: API_URL,  // Будет использовать прокси из vite.config.js
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Expires': '0'
  },
})

// Add token to requests (except login)
api.interceptors.request.use(
  (config) => {
    // Don't add token to login requests
    if (config.url?.includes('/api/auth/login')) {
      console.log('🔍 Skipping auth token for login request')
      return config
    }
    
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  console.log('🔧 AuthProvider mounted')
  console.log('🔧 API_URL:', API_URL)
  
  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    
    console.log('🔧 Checking localStorage:', { token: !!token, savedUser: !!savedUser })
    
    if (token && savedUser) {
      try {
        const userData = JSON.parse(savedUser)
        setUser(userData)
        console.log('🔧 User restored from localStorage:', userData.email)
      } catch (error) {
        console.error('🔧 Error parsing saved user:', error)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    }
    
    setLoading(false)
    console.log('🔧 AuthProvider initialization complete')
  }, [])

  const login = async (email, password) => {
    try {
      const loginUrl = `${API_URL}/api/auth/login`
      console.log('🔍 Login URL:', loginUrl)
      console.log('🔍 API_URL:', API_URL)
      console.log('🔍 Email:', email)
      
      const response = await api.post('/api/auth/login', { email, password })
      console.log('✅ Login response:', response.status)
      
      const { access_token, user: userData } = response.data
      
      localStorage.setItem('token', access_token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      
      return { success: true }
    } catch (error) {
      console.error('❌ Login error:', error)
      console.error('❌ Error response:', error.response?.data)
      console.error('❌ Error status:', error.response?.status)
      console.error('❌ Error headers:', error.response?.headers)
      
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed - Network error'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData)
      return { success: true, message: response.data.message }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Registration failed'
      }
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, api }}>
      {children}
    </AuthContext.Provider>
  )
}

export { api }