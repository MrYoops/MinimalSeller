import React, { useState } from 'react';
import { FiBox, FiPackage, FiLayers } from 'react-icons/fi';
import { BsBoxSeam } from 'react-icons/bs';
import WarehousesListPage from './WarehousesListPage';
import InventoryPage from './InventoryPage';
import StockPage from './StockPage';

function WarehousesSection() {
  const [subTab, setSubTab] = useState('warehouses'); // warehouses, inventory, stock

  return (
    <div className="space-y-6">
      {/* Sub-tabs for Warehouses Section */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setSubTab('warehouses')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'warehouses'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <BsBoxSeam className="inline mr-2" />
          МОИ СКЛАДЫ
        </button>
        <button
          onClick={() => setSubTab('stock')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'stock'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiBox className="inline mr-2" />
          ОСТАТКИ
        </button>
        <button
          onClick={() => setSubTab('inventory')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'inventory'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiLayers className="inline mr-2" />
          ИНВЕНТАРЬ
        </button>
      </div>

      {/* Content */}
      <div>
        {subTab === 'warehouses' && <WarehousesListPage />}
        {subTab === 'stock' && <StockPage />}
        {subTab === 'inventory' && <InventoryPage />}
      </div>
    </div>
  );
}

export default WarehousesSection;
