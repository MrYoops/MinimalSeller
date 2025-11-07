import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminDashboard from './pages/AdminDashboard'
import SellerDashboard from './pages/SellerDashboard'
import ProductEditPage from './pages/ProductEditPage'
import OrderDetailPage from './pages/OrderDetailPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <div className="text-mm-cyan font-mono text-lg animate-pulse">
          // LOADING...
        </div>
      </div>
    )
  }
  
  if (!user) {
    return <Navigate to="/login" />
  }
  
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/" />
  }
  
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
      
      <Route
        path="/"
        element={
          <ProtectedRoute>
            {user?.role === 'admin' ? <AdminDashboard /> : <SellerDashboard />}
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/admin/*"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/seller/*"
        element={
          <ProtectedRoute requiredRole="seller">
            <SellerDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/products/:id/edit"
        element={
          <ProtectedRoute>
            <ProductEditPage />
          </ProtectedRoute>
        }
      />
      
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