import React, { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function Dashboard() {
  const { user, logout } = useAuth()
  
  return (
    <div className="min-h-screen bg-mm-black">
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-mm-text">
              MINIMAL<span className="text-mm-purple">MOD</span>
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-mm-text-secondary">{user?.email}</span>
              <button onClick={logout} className="btn-primary">LOGOUT</button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="card-neon">
          <h2 className="text-xl mb-4 text-mm-cyan">WELCOME TO MINIMALMOD</h2>
          <p className="text-mm-text-secondary mb-4">Role: {user?.role}</p>
          <p className="comment">// System is loading...</p>
        </div>
      </main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }
  
  if (!user) return <Navigate to="/login" />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App