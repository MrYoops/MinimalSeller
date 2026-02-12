import React from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import IntegrationsApp from './IntegrationsApp'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse font-mono">// LOADING...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <IntegrationsApp />
}

function AppWithAuth() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default AppWithAuth
