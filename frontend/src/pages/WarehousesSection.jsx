import React, { useState } from 'react';
import { FiBox, FiPackage, FiLayers, FiUser, FiDownload, FiActivity } from 'react-icons/fi';
import { BsBoxSeam } from 'react-icons/bs';
import WarehousesPageV2 from './WarehousesPageV2';
import InventoryPage from './InventoryPage';
import StockPageV2 from './StockPageV2';
import SuppliersPage from './SuppliersPage';
import IncomeOrdersPage from './IncomeOrdersPage';
import StockSyncHistoryPage from './StockSyncHistoryPage';

function WarehousesSection() {
  const [subTab, setSubTab] = useState('warehouses');

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Warehouses Section */}
      <div className="flex space-x-4 border-b border-mm-border overflow-x-auto">
        <button
          onClick={() => setSubTab('warehouses')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'warehouses'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-warehouses"
        >
          <BsBoxSeam className="inline mr-2" />
          СКЛАДЫ
        </button>
        <button
          onClick={() => setSubTab('suppliers')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'suppliers'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-suppliers"
        >
          <FiUser className="inline mr-2" />
          ПОСТАВЩИКИ
        </button>
        <button
          onClick={() => setSubTab('income')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'income'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-income"
        >
          <FiDownload className="inline mr-2" />
          ПРИЁМКА НА СКЛАД
        </button>
        <button
          onClick={() => setSubTab('stock')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'stock'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-stock"
        >
          <FiBox className="inline mr-2" />
          ОСТАТКИ
        </button>
        <button
          onClick={() => setSubTab('inventory')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'inventory'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-inventory"
        >
          <FiLayers className="inline mr-2" />
          ИНВЕНТАРЬ
        </button>
        <button
          onClick={() => setSubTab('sync')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors whitespace-nowrap ${
            subTab === 'sync'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
          data-testid="tab-sync"
        >
          <FiActivity className="inline mr-2" />
          СИНХРОНИЗАЦИЯ
        </button>
      </div>

      {/* Content */}
      <div>
        {subTab === 'warehouses' && <WarehousesPageV2 />}
        {subTab === 'suppliers' && <SuppliersPage />}
        {subTab === 'income' && <IncomeOrdersPage />}
        {subTab === 'stock' && <StockPage />}
        {subTab === 'inventory' && <InventoryPage />}
        {subTab === 'sync' && <StockSyncHistoryPage />}
      </div>
    </div>
  );
}

export default WarehousesSection;
