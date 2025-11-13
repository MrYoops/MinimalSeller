import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const StockBalancesPage = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWarehouse, setSelectedWarehouse] = useState('MAin');
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

  const handleBulkMerge = () => {
    if (selectedRows.length === 0) {
      alert('Выберите товары для объединения');
      return;
    }
    alert('Массовое объединение - в разработке');
  };

  const handleDownload = () => {
    alert('Скачать - в разработке');
  };

  const handleTransfer = () => {
    if (selectedRows.length === 0) {
      alert('Выберите товары для переноса');
      return;
    }
    alert('Перенос - в разработке');
  };

  const filteredStock = stock.filter(item =>
    item.product_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.sku?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Остатки на ваших складах</h1>
        
        {/* Filters */}
        <div className="flex gap-4 items-center mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">СКЛАД</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="MAin">MAin</option>
              <option value="all">Все склады</option>
            </select>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hasStock}
                onChange={(e) => setHasStock(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">ЕСТЬ ОСТАТОК</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={updateMarketplace}
                onChange={(e) => setUpdateMarketplace(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">ОБНОВИТЬ НА МАРКЕТПЛЕЙСЕ</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={noStock}
                onChange={(e) => setNoStock(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">НЕТ ОСТАТОК</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDuplicates}
                onChange={(e) => setShowDuplicates(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="text-sm text-gray-700">ПОКАЗАТЬ СТОЛБЕЦ "ДУБЛИКАТЫ"</span>
            </label>
          </div>
        </div>

        {/* Search */}
        <div className="flex gap-3 items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, штрих-коду, артикулу, бренду"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
            🔍
          </button>
        </div>
      </div>

      {/* Action Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-1">
          <button className="px-6 py-3 bg-blue-500 text-white font-semibold border-b-2 border-blue-600">
            Остатки
          </button>
          <button className="px-6 py-3 text-gray-600 hover:bg-gray-50">
            Объединение
          </button>
          <button className="px-6 py-3 text-gray-600 hover:bg-gray-50">
            Массовое объединение
          </button>
          <button className="px-6 py-3 text-gray-600 hover:bg-gray-50">
            Скачать
          </button>
          <button className="px-6 py-3 text-gray-600 hover:bg-gray-50">
            Сверка
          </button>
          <button className="px-6 py-3 text-gray-600 hover:bg-gray-50">
            Перенос
          </button>
        </div>
      </div>

      {/* Table Controls */}
      <div className="bg-white px-6 py-3 flex justify-between items-center border-b">
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            СБРОСИТЬ ФИЛЬТРЫ
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            ВЕРНУТЬ ПОРЯДОК СТОЛБЦОВ
          </button>
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm">
            СТОЛБЦЫ
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Высота строки</span>
          <input type="range" min="1" max="3" className="w-24" />
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" className="w-4 h-4" />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ошибка</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Фото</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Размер</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Остаток на выбранном...</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ссылки</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">В резерве</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Место</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Действия</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Штрих-код</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Размер</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ссылки</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Бренд</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Цвет</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">В архив / Удалить</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">SKU</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Артикул продавца</th>
                {showDuplicates && (
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Дубликаты</th>
                )}
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Объединить</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="20" className="px-4 py-8 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredStock.length === 0 ? (
                <tr>
                  <td colSpan="20" className="px-4 py-8 text-center text-gray-500">
                    Данные не найдены
                  </td>
                </tr>
              ) : (
                filteredStock.map((item, index) => (
                  <tr key={index} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="w-4 h-4" />
                    </td>
                    <td className="px-4 py-3">
                      {item.error && <span className="text-red-600">⚠️</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400">
                        📷
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-blue-600 hover:underline cursor-pointer font-medium">
                        {item.product_name || 'Без названия'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.size || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">{item.quantity || 0}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline text-sm">Ссылки</button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.reserved || 0}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.location || '-'}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline text-sm">✏️</button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.barcode || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.size || '-'}</td>
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline text-sm">🔗</button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.brand || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.color || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="text-gray-600 hover:text-gray-800">📦</button>
                        <button className="text-red-600 hover:text-red-800">🗑️</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.sku || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.id || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.seller_sku || '-'}</td>
                    {showDuplicates && (
                      <td className="px-4 py-3 text-sm text-gray-600">-</td>
                    )}
                    <td className="px-4 py-3">
                      <button className="text-blue-600 hover:underline text-sm">Объединить</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 flex justify-between items-center border-t">
          <div className="flex items-center gap-2">
            <select className="border border-gray-300 rounded px-2 py-1 text-sm">
              <option>200</option>
              <option>50</option>
              <option>100</option>
            </select>
            <span className="text-sm text-gray-600">Строк на странице</span>
          </div>
          <div className="text-sm text-gray-600">
            0 - 0 из 0. Страница 1 из 1
          </div>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">
              Выделено строк: 0
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockBalancesPage;
