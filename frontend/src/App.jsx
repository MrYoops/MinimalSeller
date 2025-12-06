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
// Warehouse module pages
import WarehousesPageV2 from './pages/WarehousesPageV2'
import SuppliersPage from './pages/SuppliersPage'
import IncomeOrdersPage from './pages/IncomeOrdersPage'
import IncomeOrderFormPage from './pages/IncomeOrderFormPage'
// Stock pages
import StockPageV3 from './pages/StockPageV3'
import StockSyncHistoryPage from './pages/StockSyncHistoryPage'
// Orders & Finance
import OrdersPageNew from './pages/OrdersPageNew'
import FinanceDashboard from './pages/FinanceDashboard'
import PayoutsPage from './pages/PayoutsPage'
import ProfitReportPage from './pages/ProfitReportPage'
import TransactionsPage from './pages/TransactionsPage'
import AnalyticsReportsPage from './pages/AnalyticsReportsPage'
// Layout
import MainLayout from './components/MainLayout'
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

// Wrapper component for pages that need MainLayout
function WithLayout({ children }) {
  return (
    <MainLayout>
      {children}
    </MainLayout>
  )
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      
      {/* Home - redirects based on role */}
      <Route path="/" element={
        <ProtectedRoute>
          {user?.role === 'admin' ? <AdminDashboardV2 /> : <Navigate to="/catalog/products" />}
        </ProtectedRoute>
      } />
      
      {/* Integrations */}
      <Route path="/integrations" element={
        <ProtectedRoute><WithLayout><IntegrationsPage /></WithLayout></ProtectedRoute>
      } />
      
      {/* Warehouse Section */}
      <Route path="/warehouses" element={
        <ProtectedRoute><WithLayout><WarehousesPageV2 /></WithLayout></ProtectedRoute>
      } />
      <Route path="/warehouses/:id" element={
        <ProtectedRoute><WithLayout><WarehouseDetailNew /></WithLayout></ProtectedRoute>
      } />
      <Route path="/suppliers" element={
        <ProtectedRoute><WithLayout><SuppliersPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/income-orders" element={
        <ProtectedRoute><WithLayout><IncomeOrdersPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/income-orders/new" element={
        <ProtectedRoute><WithLayout><IncomeOrderFormPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/income-orders/:id/edit" element={
        <ProtectedRoute><WithLayout><IncomeOrderFormPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/stock" element={
        <ProtectedRoute><WithLayout><StockPageV3 /></WithLayout></ProtectedRoute>
      } />
      <Route path="/stock/sync" element={
        <ProtectedRoute><WithLayout><StockSyncHistoryPage /></WithLayout></ProtectedRoute>
      } />
      
      {/* Catalog/Products Section */}
      <Route path="/catalog/products" element={
        <ProtectedRoute><WithLayout><CatalogProductsPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/products/new" element={
        <ProtectedRoute><WithLayout><CatalogProductFormV4 /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/products/:id/edit" element={
        <ProtectedRoute><WithLayout><CatalogProductFormV4 /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/categories" element={
        <ProtectedRoute><WithLayout><CatalogCategoriesPageSimple /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/pricing" element={
        <ProtectedRoute><WithLayout><PricingPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/matching" element={
        <ProtectedRoute><WithLayout><ProductMatchingPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/catalog/import" element={
        <ProtectedRoute><WithLayout><CatalogImportPage /></WithLayout></ProtectedRoute>
      } />
      
      {/* Orders & Finance */}
      <Route path="/orders" element={
        <ProtectedRoute><WithLayout><OrdersPageNew /></WithLayout></ProtectedRoute>
      } />
      <Route path="/orders/fbs" element={
        <ProtectedRoute><WithLayout><OrdersPageNew section="fbs" /></WithLayout></ProtectedRoute>
      } />
      <Route path="/orders/fbo" element={
        <ProtectedRoute><WithLayout><OrdersPageNew section="fbo" /></WithLayout></ProtectedRoute>
      } />
      <Route path="/orders/retail" element={
        <ProtectedRoute><WithLayout><OrdersPageNew section="retail" /></WithLayout></ProtectedRoute>
      } />
      <Route path="/finance" element={
        <ProtectedRoute><WithLayout><FinanceDashboard /></WithLayout></ProtectedRoute>
      } />
      <Route path="/balance" element={
        <ProtectedRoute><WithLayout><PayoutsPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/profit-report" element={
        <ProtectedRoute><WithLayout><ProfitReportPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/transactions" element={
        <ProtectedRoute><WithLayout><TransactionsPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/analytics-reports" element={
        <ProtectedRoute><WithLayout><AnalyticsReportsPage /></WithLayout></ProtectedRoute>
      } />
      
      {/* Legacy routes */}
      <Route path="/products/:id/edit" element={
        <ProtectedRoute><WithLayout><ProductEditPage /></WithLayout></ProtectedRoute>
      } />
      <Route path="/products-new" element={
        <ProtectedRoute><WithLayout><ProductsPageNew /></WithLayout></ProtectedRoute>
      } />
      <Route path="/stock-balances" element={
        <ProtectedRoute><WithLayout><StockBalancesPage /></WithLayout></ProtectedRoute>
      } />
      
      {/* Admin routes */}
      <Route path="/admin/categories" element={
        <ProtectedRoute requiredRole="admin"><AdminCategoriesPage /></ProtectedRoute>
      } />
      <Route path="/admin/internal-categories" element={
        <ProtectedRoute requiredRole="admin"><InternalCategoriesPage /></ProtectedRoute>
      } />
      
      <Route path="*" element={<Navigate to="/catalog/products" />} />
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