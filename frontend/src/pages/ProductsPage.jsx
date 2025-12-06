import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

// Генератор случайного цвета для тега
const generateTagColor = (tag) => {
  const colors = [
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'bg-green-500/20 text-green-300 border-green-500/30',
    'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'bg-pink-500/20 text-pink-300 border-pink-500/30',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'bg-red-500/20 text-red-300 border-red-500/30',
  ];
  
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMarketplace, setSelectedMarketplace] = useState('Wildberries');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [rowHeight, setRowHeight] = useState(2);
  
  // Tags management modals
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [showBulkActionsPanel, setShowBulkActionsPanel] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedActionTag, setSelectedActionTag] = useState('');

  useEffect(() => {
    fetchProducts();
    fetchTags();
  }, []);

  useEffect(() => {
    setShowBulkActionsPanel(selectedProducts.length > 0);
  }, [selectedProducts]);

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

  const fetchTags = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/products/tags`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllTags(response.data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('Введите название тега');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/products/tags?tag_name=${encodeURIComponent(newTagName.trim())}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setAllTags([...allTags, newTagName.trim()]);
      setNewTagName('');
      alert(`Тег "${newTagName.trim()}" создан`);
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка создания тега');
    }
  };

  const handleDeleteTag = async (tagName) => {
    if (!confirm(`Удалить тег "${tagName}" из всех товаров?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/products/tags/${encodeURIComponent(tagName)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setAllTags(allTags.filter(t => t !== tagName));
      await fetchProducts();
      alert(`Тег "${tagName}" удален`);
    } catch (error) {
      alert('Ошибка удаления тега');
    }
  };

  const handleBulkAssignTag = async () => {
    if (!selectedActionTag) {
      alert('Выберите тег');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/products/bulk-assign-tags`,
        {
          product_ids: selectedProducts,
          tag: selectedActionTag
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchProducts();
      await fetchTags();
      setSelectedProducts([]);
      setSelectedActionTag('');
      alert(`Тег "${selectedActionTag}" присвоен выбранным товарам`);
    } catch (error) {
      alert('Ошибка присвоения тега');
    }
  };

  const handleBulkRemoveTag = async () => {
    if (!selectedActionTag) {
      alert('Выберите тег для удаления');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/products/bulk-remove-tags`,
        {
          product_ids: selectedProducts,
          tag: selectedActionTag
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchProducts();
      await fetchTags();
      setSelectedProducts([]);
      setSelectedActionTag('');
      alert(`Тег "${selectedActionTag}" удален у выбранных товаров`);
    } catch (error) {
      alert('Ошибка удаления тега');
    }
  };

  const handleRemoveTagFromProduct = async (productId, tagName) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${API_URL}/api/products/bulk-remove-tags`,
        {
          product_ids: [productId],
          tag: tagName
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      await fetchProducts();
      await fetchTags();
    } catch (error) {
      alert('Ошибка удаления тега');
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

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedProducts(filteredProducts.map(p => p.id));
    } else {
      setSelectedProducts([]);
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

      {/* Tags Management Button */}
      <div className="flex justify-start">
        <button
          onClick={() => setShowTagsModal(true)}
          className="px-4 py-2 bg-mm-purple/20 border border-mm-purple text-mm-purple rounded hover:bg-mm-purple/30 font-mono text-sm"
        >
          🏷️ УПРАВЛЕНИЕ ТЕГАМИ
        </button>
      </div>

      {/* Bulk Actions Panel */}
      {showBulkActionsPanel && (
        <div className="card-neon p-4 bg-mm-purple/10 border-mm-purple">
          <div className="flex items-center gap-4">
            <span className="text-mm-text font-mono">
              Выбрано товаров: <span className="text-mm-purple font-bold">{selectedProducts.length}</span>
            </span>
            <div className="flex-1 flex items-center gap-2">
              <select
                value={selectedActionTag}
                onChange={(e) => setSelectedActionTag(e.target.value)}
                className="px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded"
              >
                <option value="">-- Выберите тег --</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
              <button
                onClick={handleBulkAssignTag}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Присвоить тег
              </button>
              <button
                onClick={handleBulkRemoveTag}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Удалить тег
              </button>
            </div>
            <button
              onClick={() => setSelectedProducts([])}
              className="px-3 py-2 bg-mm-dark border border-mm-border text-mm-text-secondary rounded hover:bg-mm-gray"
            >
              Отменить выбор
            </button>
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
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="w-4 h-4"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Фото</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Название</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Артикул</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Теги</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Категория</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Цена</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Остаток</th>
                <th className="px-4 py-3 text-left text-sm font-mono text-mm-text-secondary uppercase">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-mm-cyan animate-pulse">
                    // LOADING...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-mm-text-secondary">
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
                    <td className="px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {product.tags && product.tags.length > 0 ? (
                          product.tags.map(tag => (
                            <span
                              key={tag}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${generateTagColor(tag)}`}
                            >
                              {tag}
                              <button
                                onClick={() => handleRemoveTagFromProduct(product.id, tag)}
                                className="hover:opacity-70"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))
                        ) : (
                          <span className="text-mm-text-tertiary text-xs">-</span>
                        )}
                      </div>
                    </td>
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

      {/* Tags Management Modal */}
      {showTagsModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-mm-dark border-2 border-mm-purple rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-mono text-mm-purple">// УПРАВЛЕНИЕ ТЕГАМИ</h2>
              <button
                onClick={() => setShowTagsModal(false)}
                className="text-mm-text-secondary hover:text-mm-text"
              >
                <X size={24} />
              </button>
            </div>

            {/* Create new tag */}
            <div className="mb-6 p-4 bg-mm-gray rounded border border-mm-border">
              <label className="block text-sm text-mm-text-secondary mb-2">Создать новый тег</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Название тега..."
                  className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border text-mm-text rounded focus:border-mm-cyan focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateTag();
                  }}
                />
                <button
                  onClick={handleCreateTag}
                  className="px-4 py-2 bg-mm-purple text-white rounded hover:bg-opacity-80"
                >
                  Создать
                </button>
              </div>
            </div>

            {/* Existing tags list */}
            <div>
              <h3 className="text-mm-text mb-2 font-mono">Существующие теги:</h3>
              {allTags.length === 0 ? (
                <p className="text-mm-text-secondary text-sm">Теги отсутствуют. Создайте первый тег выше.</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {allTags.map(tag => (
                    <div
                      key={tag}
                      className="flex items-center justify-between p-3 bg-mm-gray rounded border border-mm-border hover:border-mm-purple"
                    >
                      <span className={`px-3 py-1 rounded border ${generateTagColor(tag)}`}>
                        {tag}
                      </span>
                      <button
                        onClick={() => handleDeleteTag(tag)}
                        className="px-3 py-1 bg-red-600/20 text-red-400 border border-red-600/30 rounded hover:bg-red-600/30"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
