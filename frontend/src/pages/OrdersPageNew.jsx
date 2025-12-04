import React, { useState } from 'react'
import FBSOrdersList from '../components/orders/FBSOrdersList'
import FBOOrdersList from '../components/orders/FBOOrdersList'
import RetailOrdersList from '../components/orders/RetailOrdersList'
import { FiPackage, FiTruck, FiShoppingBag } from 'react-icons/fi'

function OrdersPageNew() {
  const [activeTab, setActiveTab] = useState('fbs')

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase font-mono">Заказы</h2>
          <p className="text-sm text-mm-text-secondary font-mono">// Управление заказами со всех источников</p>
        </div>
      </div>

      {/* Custom Tabs */}
      <div className="w-full">
        <div className="grid grid-cols-3 gap-2 bg-mm-gray border border-mm-border p-2 rounded">
          <button
            onClick={() => setActiveTab('fbs')}
            className={`flex items-center justify-center space-x-2 px-4 py-3 font-mono text-sm transition-all rounded ${
              activeTab === 'fbs' 
                ? 'bg-mm-cyan text-mm-bg' 
                : 'text-mm-text hover:bg-mm-cyan/10'
            }`}
            data-testid="tab-fbs"
          >
            <FiPackage />
            <span>FBS (со своего склада)</span>
          </button>
          <button
            onClick={() => setActiveTab('fbo')}
            className={`flex items-center justify-center space-x-2 px-4 py-3 font-mono text-sm transition-all rounded ${
              activeTab === 'fbo' 
                ? 'bg-mm-purple text-mm-bg' 
                : 'text-mm-text hover:bg-mm-purple/10'
            }`}
            data-testid="tab-fbo"
          >
            <FiTruck />
            <span>FBO (со склада МП)</span>
          </button>
          <button
            onClick={() => setActiveTab('retail')}
            className={`flex items-center justify-center space-x-2 px-4 py-3 font-mono text-sm transition-all rounded ${
              activeTab === 'retail' 
                ? 'bg-mm-green text-mm-bg' 
                : 'text-mm-text hover:bg-mm-green/10'
            }`}
            data-testid="tab-retail"
          >
            <FiShoppingBag />
            <span>Розничные заказы</span>
          </button>
        </div>

        <div className="mt-6">
          {activeTab === 'fbs' && <FBSOrdersList />}
          {activeTab === 'fbo' && <FBOOrdersList />}
          {activeTab === 'retail' && <RetailOrdersList />}
        </div>
      </div>
    </div>
  )
}

export default OrdersPageNew
