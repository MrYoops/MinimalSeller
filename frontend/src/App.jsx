import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import AdminDashboardV2 from './pages/AdminDashboardV2'
import AdminCategoriesPage from './pages/AdminCategoriesPage'
import SellerDashboard from './pages/SellerDashboard'
import ProductEditPage from './pages/ProductEditPage'
import ProductsPageNew from './pages/ProductsPageNew'
import StockBalancesPage from './pages/StockBalancesPage'
import WarehouseDetailNew from './pages/WarehouseDetailNew'
import IntegrationsPage from './pages/IntegrationsPage'
import CatalogProductsPage from './pages/CatalogProductsPage'
import CatalogCategoriesPageV2 from './pages/CatalogCategoriesPageV2'
import CatalogCategoriesPageSimple from './pages/CatalogCategoriesPageSimple'
import CatalogProductFormV4 from './pages/CatalogProductFormV4'
import CatalogProductFormPage from './pages/CatalogProductFormPage'
import CatalogImportPage from './pages/CatalogImportPage'
import ProductMatchingPage from './pages/ProductMatchingPage'
import PricingPage from './pages/PricingPage'
import InternalCategoriesPage from './pages/InternalCategoriesPage'
// NEW: Warehouse module pages
import WarehousesPageV2 from './pages/WarehousesPageV2'
import SuppliersPage from './pages/SuppliersPage'
import IncomeOrdersPage from './pages/IncomeOrdersPage'
import IncomeOrderFormPage from './pages/IncomeOrderFormPage'
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
          {user?.role === 'admin' ? <AdminDashboardV2 /> : <SellerDashboard />}
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
        <ProtectedRoute><CatalogCategoriesPageSimple /></ProtectedRoute>
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
      <Route path="/catalog/matching" element={
        <ProtectedRoute><ProductMatchingPage /></ProtectedRoute>
      } />
      <Route path="/admin/categories" element={
        <ProtectedRoute requiredRole="admin"><AdminCategoriesPage /></ProtectedRoute>
      } />
      <Route path="/admin/internal-categories" element={
        <ProtectedRoute requiredRole="admin"><InternalCategoriesPage /></ProtectedRoute>
      } />
      {/* NEW: Warehouse module routes */}
      <Route path="/warehouses" element={
        <ProtectedRoute><WarehousesPageV2 /></ProtectedRoute>
      } />
      <Route path="/suppliers" element={
        <ProtectedRoute><SuppliersPage /></ProtectedRoute>
      } />
      <Route path="/income-orders" element={
        <ProtectedRoute><IncomeOrdersPage /></ProtectedRoute>
      } />
      <Route path="/income-orders/new" element={
        <ProtectedRoute><IncomeOrderFormPage /></ProtectedRoute>
      } />
      <Route path="/income-orders/:id/edit" element={
        <ProtectedRoute><IncomeOrderFormPage /></ProtectedRoute>
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
          <Toaster 
            position="top-right"
            theme="dark"
            toastOptions={{
              style: {
                background: '#0a0e27',
                border: '1px solid #00f0ff',
                color: '#e0e7ff'
              }
            }}
          />
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App