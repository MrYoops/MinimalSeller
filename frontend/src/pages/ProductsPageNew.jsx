import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const ProductsPageNew = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('Wildberries');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [rowHeight, setRowHeight] = useState(2);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoading(false);
    }
  };

  const handleCreateProduct = () => {
    navigate('/products/new');
  };

  const handleCreateOrder = () => {
    navigate('/orders/new');
  };

  const handleBulkEdit = () => {
    if (selectedProducts.length === 0) {
      alert('Выберите товары для редактирования');
      return;
    }
    alert('Массовое редактирование - в разработке');
  };

  const handleExport = () => {
    alert('Экспорт - в разработке');
  };

  const handleArchive = () => {
    if (selectedProducts.length === 0) {
      alert('Выберите товары для архивации');
      return;
    }
    if (confirm(`Переместить ${selectedProducts.length} товаров в архив?`)) {
      alert('Архивация - в разработке');
    }
  };

  const handleDelete = () => {
    if (selectedProducts.length === 0) {
      alert('Выберите товары для удаления');
      return;
    }
    if (confirm(`Удалить ${selectedProducts.length} товаров?`)) {
      alert('Удаление - в разработке');
    }
  };

  const handlePrint = () => {
    alert('Печать этикеток - в разработке');
  };

  const toggleProductSelection = (productId) => {
    if (selectedProducts.includes(productId)) {
      setSelectedProducts(selectedProducts.filter(id => id !== productId));
    } else {
      setSelectedProducts([...selectedProducts, productId]);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (product.barcode && product.barcode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Action Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-3">
            <button
              onClick={handleCreateProduct}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700"
            >
              СОЗДАТЬ ТОВАР
            </button>
            <button
              onClick={handleCreateOrder}
              className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg hover:bg-yellow-600"
            >
              СОЗДАТЬ ЗАКАЗ
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkEdit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              МАССОВОЕ РЕДАКТИРОВАНИЕ
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ЭКСПОРТ
            </button>
            <button
              onClick={handleArchive}
              className="p-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              title="Переместить в архив"
            >
              📦
            </button>
            <button
              onClick={handleDelete}
              className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
              title="Удалить"
            >
              🗑️
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
          >
            ФИЛЬТР
          </button>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по названию, штрих-коду, артикулу, бренду"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={selectedMarketplace}
            onChange={(e) => setSelectedMarketplace(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg"
          >
            <option>Wildberries</option>
            <option>Ozon</option>
            <option>Яндекс.Маркет</option>
          </select>
          <select className="px-4 py-2 border border-gray-300 rounded-lg">
            <option>Этикетка для товаров простая</option>
            <option>Этикетка расширенная</option>
          </select>
          <button
            onClick={handlePrint}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
          >
            ПЕЧАТЬ
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Категория</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Все категории</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Бренд</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Все бренды</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Производитель</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Все производители</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">Статус</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                <option>Все статусы</option>
                <option>Активные</option>
                <option>В архиве</option>
              </select>
            </div>
          </div>
        </div>
      )}

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
          <input
            type="range"
            min="1"
            max="3"
            value={rowHeight}
            onChange={(e) => setRowHeight(parseInt(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(filteredProducts.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Фото</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Размер</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ссылки</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Бренд</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Избранное</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Штрих-код</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Артикул</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Цена</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Остаток</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                    Загрузка...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="12" className="px-4 py-8 text-center text-gray-500">
                    Данные не найдены
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr
                    key={product.id}
                    className={`border-b hover:bg-gray-50 ${
                      rowHeight === 1 ? 'h-12' : rowHeight === 2 ? 'h-16' : 'h-24'
                    }`}
                  >
                    <td className="px-4">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="px-4">
                      <div className={`bg-gray-200 rounded flex items-center justify-center text-gray-400 ${
                        rowHeight === 1 ? 'w-10 h-10' : rowHeight === 2 ? 'w-12 h-12' : 'w-16 h-16'
                      }`}>
                        📷
                      </div>
                    </td>
                    <td className="px-4">
                      <button
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="px-4 text-sm text-gray-600">{product.size || '-'}</td>
                    <td className="px-4">
                      <button className="text-blue-600 hover:underline text-sm">Ссылки</button>
                    </td>
                    <td className="px-4 text-sm text-gray-600">{product.brand || '-'}</td>
                    <td className="px-4">
                      <button className="text-yellow-500 hover:text-yellow-600">⭐</button>
                    </td>
                    <td className="px-4 text-sm text-gray-600">{product.barcode || '-'}</td>
                    <td className="px-4 text-sm text-gray-600">{product.sku || '-'}</td>
                    <td className="px-4 text-sm font-semibold text-gray-800">
                      {product.price ? `${product.price} ₽` : '-'}
                    </td>
                    <td className="px-4 text-sm text-gray-600">{product.stock_quantity || 0}</td>
                    <td className="px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          ✏️
                        </button>
                        <button className="text-red-600 hover:underline text-sm">🗑️</button>
                      </div>
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
              <option>50</option>
              <option>100</option>
              <option>200</option>
            </select>
            <span className="text-sm text-gray-600">Строк на странице</span>
          </div>
          <div className="text-sm text-gray-600">
            Страница 1 из 1 | Выделено строк: {selectedProducts.length}
          </div>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">
              ◀◀
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">
              ◀
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">
              ▶
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-100 text-sm">
              ▶▶
            </button>
          </div>
        </div>
      </div>

      {/* Left Sidebar Menu (if needed) */}
      <div className="fixed left-0 top-16 w-64 bg-gray-800 text-white h-full overflow-y-auto hidden">
        <div className="p-4">
          <h3 className="font-semibold mb-2">Товары</h3>
          <ul className="space-y-1 text-sm">
            <li><a href="/products" className="block px-3 py-2 rounded hover:bg-gray-700">Товары</a></li>
            <li><a href="/products/import" className="block px-3 py-2 rounded hover:bg-gray-700">Импорт товаров</a></li>
            <li><a href="/products/merge" className="block px-3 py-2 rounded hover:bg-gray-700">Объединение</a></li>
            <li><a href="/products/photos" className="block px-3 py-2 rounded hover:bg-gray-700">Фото</a></li>
            <li><a href="/products/categories" className="block px-3 py-2 rounded hover:bg-gray-700">Категории</a></li>
            <li><a href="/products/brands" className="block px-3 py-2 rounded hover:bg-gray-700">Бренды</a></li>
            <li><a href="/products/manufacturers" className="block px-3 py-2 rounded hover:bg-gray-700">Производители</a></li>
            <li><a href="/products/parameters" className="block px-3 py-2 rounded hover:bg-gray-700">Параметры</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ProductsPageNew;
