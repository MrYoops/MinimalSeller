import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import SellerDashboard from './pages/SellerDashboard'
import ProductEditPage from './pages/ProductEditPage'
// import WarehouseDetailPage from './pages/WarehouseDetailPage'
import ProductsPageNew from './pages/ProductsPageNew'
import StockBalancesPage from './pages/StockBalancesPage'
// import WarehouseDetail from './pages/WarehouseDetail'
import WarehouseDetailNew from './pages/WarehouseDetailNew'
import IntegrationsPage from './pages/IntegrationsPage'
import CatalogProductsPage from './pages/CatalogProductsPage'
import CatalogCategoriesPage from './pages/CatalogCategoriesPage'
import CatalogProductFormV4 from './pages/CatalogProductFormV4'
import CatalogProductFormPage from './pages/CatalogProductFormPage' // Старая форма
import CatalogImportPage from './pages/CatalogImportPage'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'

function ProtectedRoute({ children, requiredRole }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }
  
  if (!user) return <Navigate to="/login" />
  if (requiredRole && user.role !== requiredRole) return <Navigate to="/" />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'admin' ? <AdminDashboard /> : <SellerDashboard />}
        </ProtectedRoute>
      } />
      <Route path="/products/:id/edit" element={
        <ProtectedRoute><ProductEditPage /></ProtectedRoute>
      } />
      <Route path="/warehouses/:id" element={
        <ProtectedRoute><WarehouseDetailNew /></ProtectedRoute>
      } />
      <Route path="/integrations" element={
        <ProtectedRoute><IntegrationsPage /></ProtectedRoute>
      } />
      {/* <Route path="/warehouses-old/:id" element={
        <ProtectedRoute><WarehouseDetailPage /></ProtectedRoute>
      } /> */}
      <Route path="/products-new" element={
        <ProtectedRoute><ProductsPageNew /></ProtectedRoute>
      } />
      <Route path="/stock-balances" element={
        <ProtectedRoute><StockBalancesPage /></ProtectedRoute>
      } />
      <Route path="/catalog/categories" element={
        <ProtectedRoute><CatalogCategoriesPage /></ProtectedRoute>
      } />
      <Route path="/catalog/products/new" element={
        <ProtectedRoute><CatalogProductFormV4 /></ProtectedRoute>
      } />
      <Route path="/catalog/products/:id/edit" element={
        <ProtectedRoute><CatalogProductFormV4 /></ProtectedRoute>
      } />
      <Route path="/catalog/import" element={
        <ProtectedRoute><CatalogImportPage /></ProtectedRoute>
      } />
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