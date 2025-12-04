import React, { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-mm-gray border border-mm-border">
          <TabsTrigger 
            value="fbs" 
            className="data-[state=active]:bg-mm-cyan data-[state=active]:text-mm-bg font-mono"
            data-testid="tab-fbs"
          >
            <FiPackage className="mr-2" />
            FBS (со своего склада)
          </TabsTrigger>
          <TabsTrigger 
            value="fbo" 
            className="data-[state=active]:bg-mm-purple data-[state=active]:text-mm-bg font-mono"
            data-testid="tab-fbo"
          >
            <FiTruck className="mr-2" />
            FBO (со склада МП)
          </TabsTrigger>
          <TabsTrigger 
            value="retail" 
            className="data-[state=active]:bg-mm-green data-[state=active]:text-mm-bg font-mono"
            data-testid="tab-retail"
          >
            <FiShoppingBag className="mr-2" />
            Розничные заказы
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fbs" className="mt-6">
          <FBSOrdersList />
        </TabsContent>

        <TabsContent value="fbo" className="mt-6">
          <FBOOrdersList />
        </TabsContent>

        <TabsContent value="retail" className="mt-6">
          <RetailOrdersList />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default OrdersPageNew
