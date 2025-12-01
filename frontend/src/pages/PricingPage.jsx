import React, { useState, useEffect } from 'react';
import { FiSearch, FiDollarSign, FiTrendingUp, FiAlertTriangle, FiSettings, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import PriceEditModal from '../components/PriceEditModal';
import BulkPriceUpdateModal from '../components/BulkPriceUpdateModal';
import PriceAlertBadge from '../components/PriceAlertBadge';

const PricingPage = () => {
  const { api } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceFilter, setMarketplaceFilter] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchAlerts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery, marketplaceFilter, alertFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/catalog/products/pricing');
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/api/catalog/products/pricing/alerts');
      setAlerts(response.data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.article?.toLowerCase().includes(query) ||
        p.name?.toLowerCase().includes(query)
      );
    }

    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(p => p[`${marketplaceFilter}_linked`]);
    }

    if (alertFilter === 'with_alerts') {
      const productIdsWithAlerts = alerts.map(a => a.product_id);
      filtered = filtered.filter(p => productIdsWithAlerts.includes(p.product_id));
    }

    setFilteredProducts(filtered);
  };

  const handleEditPrice = (product) => {
    setSelectedProduct(product);
    setShowEditModal(true);
  };

  const handleSyncAll = async () => {
    toast.info('Синхронизация цен...', { duration: 2000 });
    
    try {
      let successCount = 0;
      
      for (const product of products) {
        try {
          await api.post(`/api/catalog/products/${product.product_id}/pricing/sync`);
          successCount++;
        } catch (err) {
          console.error(`Failed to sync ${product.article}:`, err);
        }
      }
      
      toast.success(`✅ Синхронизировано: ${successCount} из ${products.length}`);
      await fetchProducts();
      await fetchAlerts();
    } catch (error) {
      console.error('Error syncing prices:', error);
      toast.error('Ошибка синхронизации');
    }
  };

  const handlePriceUpdate = async () => {
    await fetchProducts();
    await fetchAlerts();
    setShowEditModal(false);
  };

  const handleBulkUpdate = async () => {
    await fetchProducts();
    await fetchAlerts();
    setShowBulkModal(false);
  };

  const getProductAlerts = (productId) => {
    return alerts.filter(a => a.product_id === productId && !a.is_resolved);
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '—';
    return `${price.toFixed(0)}₽`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" data-testid="pricing-loading">
        <div className="text-center">
          <FiRefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Загрузка цен...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="pricing-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FiDollarSign className="w-8 h-8" />
            Управление ценами
          </h1>
          <p className="text-gray-600 mt-1">
            Управляйте ценами товаров на маркетплейсах
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSyncAll}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            data-testid="sync-all-btn"
          >
            <FiRefreshCw className="w-4 h-4" />
            Синхронизировать все
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            data-testid="bulk-update-btn"
          >
            <FiSettings className="w-4 h-4" />
            Массовые операции
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">Всего товаров</p>
          <p className="text-2xl font-bold mt-1">{products.length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">На Ozon</p>
          <p className="text-2xl font-bold mt-1">{products.filter(p => p.ozon_linked).length}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-600">На Wildberries</p>
          <p className="text-2xl font-bold mt-1">{products.filter(p => p.wb_linked).length}</p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg shadow border border-orange-200">
          <p className="text-sm text-orange-800">Алерты</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{alerts.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              data-testid="search-input"
            />
          </div>

          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="marketplace-filter"
          >
            <option value="all">Все маркетплейсы</option>
            <option value="ozon">Только Ozon</option>
            <option value="wb">Только WB</option>
          </select>

          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            data-testid="alert-filter"
          >
            <option value="all">Все товары</option>
            <option value="with_alerts">С алертами</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-700">Артикул</th>
                <th className="text-left p-4 font-medium text-gray-700">Фото</th>
                <th className="text-left p-4 font-medium text-gray-700">Название</th>
                <th className="text-left p-4 font-medium text-gray-700">Ozon</th>
                <th className="text-left p-4 font-medium text-gray-700">Wildberries</th>
                <th className="text-left p-4 font-medium text-gray-700">Мин. цена</th>
                <th className="text-center p-4 font-medium text-gray-700">⚠️</th>
                <th className="text-right p-4 font-medium text-gray-700">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-gray-500">
                    Товары не найдены
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const productAlerts = getProductAlerts(product.product_id);
                  const hasAlerts = productAlerts.length > 0;

                  return (
                    <tr
                      key={product.product_id}
                      className="border-b hover:bg-gray-50"
                      data-testid={`product-row-${product.article}`}
                    >
                      <td className="p-4 font-mono text-sm">{product.article}</td>
                      <td className="p-4">
                        {product.photo ? (
                          <img
                            src={product.photo}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-500 text-xs">
                            Нет фото
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="max-w-xs truncate">{product.name}</div>
                      </td>
                      <td className="p-4">
                        {product.ozon_linked ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-1 text-xs rounded bg-blue-100 text-blue-700">✅ Ozon</span>
                            {product.ozon?.price ? (
                              <div className="text-sm">
                                <span className="font-semibold">{formatPrice(product.ozon.price)}</span>
                                <span className="text-gray-500"> / {formatPrice(product.ozon.old_price)}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">Цены не установлены</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">Не привязан</span>
                        )}
                      </td>
                      <td className="p-4">
                        {product.wb_linked ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-1 text-xs rounded bg-purple-100 text-purple-700">✅ WB</span>
                            {product.wb?.regular_price ? (
                              <div className="text-sm">
                                <span className="font-semibold">{formatPrice(product.wb.discount_price || product.wb.regular_price)}</span>
                                {product.wb.discount_price && (
                                  <span className="text-gray-500"> / {formatPrice(product.wb.regular_price)}</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">Цены не установлены</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">Не привязан</span>
                        )}
                      </td>
                      <td className="p-4">
                        {product.min_allowed_price ? (
                          <span className="text-sm font-medium">{formatPrice(product.min_allowed_price)}</span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {hasAlerts && (
                          <PriceAlertBadge alerts={productAlerts} onUpdate={fetchAlerts} />
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleEditPrice(product)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                          data-testid={`edit-price-btn-${product.article}`}
                        >
                          📝 Изменить
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showEditModal && selectedProduct && (
        <PriceEditModal
          product={selectedProduct}
          onClose={() => setShowEditModal(false)}
          onUpdate={handlePriceUpdate}
        />
      )}

      {showBulkModal && (
        <BulkPriceUpdateModal
          products={products}
          onClose={() => setShowBulkModal(false)}
          onUpdate={handleBulkUpdate}
        />
      )}
    </div>
  );
};

export default PricingPage;