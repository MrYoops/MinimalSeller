import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import FBSOrdersList from '../components/orders/FBSOrdersList'
import FBOOrdersList from '../components/orders/FBOOrdersList'
import RetailOrdersList from '../components/orders/RetailOrdersList'

function OrdersPageNew({ section }) {
  const location = useLocation()
  
  // Определить текущий раздел из URL
  const currentSection = section || 
    (location.pathname.includes('/fbs') ? 'fbs' : 
     location.pathname.includes('/fbo') ? 'fbo' : 
     location.pathname.includes('/retail') ? 'retail' : 'fbs')

  const getSectionTitle = () => {
    switch(currentSection) {
      case 'fbs': return 'FBS (со своего склада)'
      case 'fbo': return 'FBO (со склада МП)'
      case 'retail': return 'Розничные заказы'
      default: return 'Заказы'
    }
  }

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase font-mono">{getSectionTitle()}</h2>
          <p className="text-sm text-mm-text-secondary font-mono">// Управление заказами</p>
        </div>
      </div>

      <div>
        {currentSection === 'fbs' && <FBSOrdersList />}
        {currentSection === 'fbo' && <FBOOrdersList />}
        {currentSection === 'retail' && <RetailOrdersList />}
      </div>
    </div>
  )
}

export default OrdersPageNew
