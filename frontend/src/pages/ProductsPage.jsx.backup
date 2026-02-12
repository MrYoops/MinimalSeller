import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const ProductsPage = () => {
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
    navigate('/products/new/edit');
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
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={handleCreateProduct}
            className="btn-primary"
          >
            + СОЗДАТЬ ТОВАР
          </button>
          <button className="px-4 py-2 bg-mm-purple text-white rounded hover:bg-opacity-80">
            СОЗДАТЬ ЗАКАЗ
          </button>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray">
            МАССОВОЕ РЕДАКТИРОВАНИЕ
          </button>
          <button className="px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray">
            ЭКСПОРТ
          </button>
          <button className="px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray" title="Архив">
            📦
          </button>
          <button className="px-3 py-2 bg-mm-dark border border-mm-border text-red-400 rounded hover:bg-mm-gray" title="Удалить">
            🗑️
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-mm-dark border border-mm-border text-mm-cyan rounded hover:bg-mm-gray font-mono"
        >
          ФИЛЬТР
        </button>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по названию, штрих-коду, артикулу..."
          className="flex-1 px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded focus:border-mm-cyan focus:outline-none"
        />
        <select
          value={selectedMarketplace}
          onChange={(e) => setSelectedMarketplace(e.target.value)}
          className="px-4 py-2 bg-mm-dark border border-mm-border text-mm-text rounded"
        >
          <option>Wildberries</option>
          <option>Ozon</option>
          <option>Яндекс.Маркет</option>
        </select>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card-neon p-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Категория</label>
              <select className="w-full px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded">
                <option>Все категории</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Бренд</label>
              <select className="w-full px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded">
                <option>Все бренды</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Производитель</label>
              <select className="w-full px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded">
                <option>Все производители</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Статус</label>
              <select className="w-full px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded">
                <option>Все статусы</option>
                <option>Активные</option>
                <option>В архиве</option>
              </select>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center gap-2">
          <span className="text-sm text-mm-text-secondary">Высота строки</span>
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
      <div className="card-neon overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-mm-border">
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
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Фото</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Название</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Артикул</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Цена</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Остаток</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-mm-cyan animate-pulse">
                    // LOADING...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-mm-text-secondary">
                    Данные не найдены
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => (
                  <tr
                    key={product.id}
                    className={`border-b border-mm-border hover:bg-mm-gray ${
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
                      {product.images && product.images[0] ? (
                        <img 
                          src={product.images[0]} 
                          alt={product.name} 
                          className={`object-cover border border-mm-border ${
                            rowHeight === 1 ? 'w-10 h-10' : rowHeight === 2 ? 'w-12 h-12' : 'w-16 h-16'
                          }`}
                        />
                      ) : (
                        <div className={`bg-mm-gray border border-mm-border flex items-center justify-center text-mm-text-tertiary ${
                          rowHeight === 1 ? 'w-10 h-10' : rowHeight === 2 ? 'w-12 h-12' : 'w-16 h-16'
                        }`}>
                          📷
                        </div>
                      )}
                    </td>
                    <td className="px-4">
                      <button
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                        className="text-mm-cyan hover:underline font-medium"
                      >
                        {product.name}
                      </button>
                      {product.description && (
                        <div className="text-xs text-mm-text-tertiary mt-1 max-w-xs truncate">
                          {product.description.substring(0, 50)}...
                        </div>
                      )}
                    </td>
                    <td className="px-4 text-sm text-mm-text font-mono">{product.sku || '-'}</td>
                    <td className="px-4 text-sm text-mm-text-secondary">{product.category || '-'}</td>
                    <td className="px-4 text-sm font-semibold text-mm-text">
                      {product.price ? `${product.price} ₽` : '-'}
                    </td>
                    <td className="px-4 text-sm text-mm-text-secondary">{product.stock_quantity || 0}</td>
                    <td className="px-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="text-mm-cyan hover:text-mm-purple text-sm"
                        >
                          ✏️
                        </button>
                        <button className="text-red-400 hover:text-red-300 text-sm">🗑️</button>
                      </div>
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
              <option>50</option>
              <option>100</option>
              <option>200</option>
            </select>
            <span className="text-sm text-mm-text-secondary">Строк на странице</span>
          </div>
          <div className="text-sm text-mm-text-secondary">
            Страница 1 из 1 | Выделено: {selectedProducts.length}
          </div>
          <div className="flex gap-1">
            <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray text-sm">
              ◀◀
            </button>
            <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray text-sm">
              ◀
            </button>
            <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray text-sm">
              ▶
            </button>
            <button className="px-3 py-1 bg-mm-dark border border-mm-border text-mm-text rounded hover:bg-mm-gray text-sm">
              ▶▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
