import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const StockPage = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [hasStock, setHasStock] = useState(true);
  const [updateMarketplace, setUpdateMarketplace] = useState(true);
  const [noStock, setNoStock] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState([]);

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/stock`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStock(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching stock:', error);
      setLoading(false);
    }
  };

  const filteredStock = stock.filter(item => {
    const matchesSearch = item.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product?.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product?.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStockFilter = (hasStock && item.quantity > 0) || (noStock && item.quantity === 0) || (!hasStock && !noStock);
    
    return matchesSearch && matchesStockFilter;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-mm-purple mb-4">ОСТАТКИ НА СКЛАДАХ</h2>
        
        {/* Filters */}
        <div className="flex gap-4 items-center mb-4">
          <div>
            <label className="block text-sm text-mm-text-secondary mb-1 font-mono uppercase">Склад</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded"
            >
              <option value="all">Все склады</option>
            </select>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasStock}
                onChange={(e) => setHasStock(e.target.checked)}
                className="w-4 h-4 text-mm-cyan rounded"
              />
              <span className="text-sm text-mm-text font-mono">ЕСТЬ ОСТАТОК</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateMarketplace}
                onChange={(e) => setUpdateMarketplace(e.target.checked)}
                className="w-4 h-4 text-mm-cyan rounded"
              />
              <span className="text-sm text-mm-text font-mono">ОБНОВИТЬ НА МАРКЕТПЛЕЙСЕ</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={noStock}
                onChange={(e) => setNoStock(e.target.checked)}
                className="w-4 h-4 text-mm-cyan rounded"
              />
              <span className="text-sm text-mm-text font-mono">НЕТ ОСТАТОК</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDuplicates}
                onChange={(e) => setShowDuplicates(e.target.checked)}
                className="w-4 h-4 text-mm-cyan rounded"
              />
              <span className="text-sm text-mm-text font-mono">ДУБЛИКАТЫ</span>
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, штрих-коду, артикулу..."
            className="flex-1 px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded focus:border-mm-cyan focus:outline-none"
          />
        </div>
      </div>

      {/* Action Tabs */}
      <div className="flex gap-1 border-b border-mm-border">
        <button className="px-6 py-3 bg-mm-cyan text-mm-black font-mono font-bold">
          ОСТАТКИ
        </button>
        <button className="px-6 py-3 text-mm-text-secondary hover:bg-mm-dark font-mono">
          ОБЪЕДИНЕНИЕ
        </button>
        <button className="px-6 py-3 text-mm-text-secondary hover:bg-mm-dark font-mono">
          МАССОВОЕ ОБЪЕДИНЕНИЕ
        </button>
        <button className="px-6 py-3 text-mm-text-secondary hover:bg-mm-dark font-mono">
          СКАЧАТЬ
        </button>
        <button className="px-6 py-3 text-mm-text-secondary hover:bg-mm-dark font-mono">
          СВЕРКА
        </button>
        <button className="px-6 py-3 text-mm-text-secondary hover:bg-mm-dark font-mono">
          ПЕРЕНОС
        </button>
      </div>

      {/* Table Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text-secondary rounded hover:bg-mm-gray text-sm">
            СБРОСИТЬ ФИЛЬТРЫ
          </button>
          <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text-secondary rounded hover:bg-mm-gray text-sm">
            СТОЛБЦЫ
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <div className="card-neon overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-mm-border">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" className="w-4 h-4" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Фото</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Название</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Склад</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Остаток</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Резерв</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Штрих-код</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Обновлено</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-mm-cyan animate-pulse">
                    // LOADING...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-mm-text-secondary">
                    Данные не найдены
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, index) => (
                  <tr key={index} className="border-b border-mm-border hover:bg-mm-gray">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="w-4 h-4" />
                    </td>
                    <td className="px-4 py-3">
                      {item.product?.images?.[0] ? (
                        <img 
                          src={item.product.images[0]} 
                          alt={item.product.name} 
                          className="w-12 h-12 object-cover border border-mm-border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-mm-gray border border-mm-border flex items-center justify-center text-mm-text-tertiary">
                          📷
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-mm-cyan hover:underline cursor-pointer font-medium">
                        {item.product?.name || 'Без названия'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-mm-text-secondary">
                      {item.warehouse?.name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-mm-text">{item.quantity || 0}</td>
                    <td className="px-4 py-3 text-sm text-mm-text-secondary">{item.reserved || 0}</td>
                    <td className="px-4 py-3 text-sm text-mm-text-secondary font-mono">{item.product?.barcode || '-'}</td>
                    <td className="px-4 py-3 text-sm text-mm-text-secondary font-mono">{item.product?.sku || '-'}</td>
                    <td className="px-4 py-3 text-sm text-mm-text-secondary">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString('ru-RU') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 flex justify-between items-center border-t border-mm-border">
          <div className="flex items-center gap-2">
            <select className="bg-mm-dark border border-mm-border text-mm-text rounded px-2 py-1 text-sm">
              <option>200</option>
              <option>50</option>
              <option>100</option>
            </select>
            <span className="text-sm text-mm-text-secondary">Строк на странице</span>
          </div>
          <div className="text-sm text-mm-text-secondary">
            Страница 1 из 1 | Выделено: {selectedRows.length}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockPage;
