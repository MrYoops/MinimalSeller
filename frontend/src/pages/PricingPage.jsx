import React, { useState, useEffect } from 'react';
import { FiSearch, FiDollarSign, FiTrendingUp, FiAlertTriangle, FiSettings, FiRefreshCw, FiPlus } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import CatalogNavDropdown from '../components/CatalogNavDropdown';
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
      const response = await api.get('/api/catalog/pricing');
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
      const response = await api.get('/api/catalog/pricing/alerts');
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
          await api.post(`/api/catalog/pricing/${product.product_id}/sync`);
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
    <div className="space-y-6" data-testid="pricing-page">
      {/* Header with Dropdown */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <CatalogNavDropdown />
          <div>
            <h1 className="text-3xl font-bold text-mm-cyan">ЦЕНЫ</h1>
            <p className="text-sm text-mm-text-secondary mt-1">Управление ценами на маркетплейсах</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2 font-semibold"
            data-testid="bulk-update-btn"
          >
            <FiSettings className="w-4 h-4" />
            МАССОВЫЕ ОПЕРАЦИИ
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
          <p className="text-sm text-mm-text-secondary">Всего товаров</p>
          <p className="text-2xl font-bold mt-1 text-mm-text">{products.length}</p>
        </div>
        <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
          <p className="text-sm text-mm-text-secondary">На Ozon</p>
          <p className="text-2xl font-bold mt-1 text-blue-400">{products.filter(p => p.ozon_linked).length}</p>
        </div>
        <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
          <p className="text-sm text-mm-text-secondary">На Wildberries</p>
          <p className="text-2xl font-bold mt-1 text-purple-400">{products.filter(p => p.wb_linked).length}</p>
        </div>
        <div className="bg-orange-900/20 p-4 rounded-lg border border-orange-500/30">
          <p className="text-sm text-orange-300">Алерты</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{alerts.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mm-text-secondary" />
            <input
              type="text"
              placeholder="Поиск по артикулу или названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
              data-testid="search-input"
            />
          </div>

          <select
            value={marketplaceFilter}
            onChange={(e) => setMarketplaceFilter(e.target.value)}
            className="px-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
            data-testid="marketplace-filter"
          >
            <option value="all">Все маркетплейсы</option>
            <option value="ozon">Только Ozon</option>
            <option value="wb">Только WB</option>
          </select>

          <select
            value={alertFilter}
            onChange={(e) => setAlertFilter(e.target.value)}
            className="px-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
            data-testid="alert-filter"
          >
            <option value="all">Все товары</option>
            <option value="with_alerts">С алертами</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-mm-secondary rounded-lg border border-mm-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-mm-dark border-b border-mm-border">
              <tr>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Артикул</th>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Фото</th>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Название</th>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Ozon</th>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Wildberries</th>
                <th className="text-left p-4 font-medium text-mm-text-secondary uppercase text-xs">Мин. цена</th>
                <th className="text-center p-4 font-medium text-mm-text-secondary uppercase text-xs">⚠️</th>
                <th className="text-right p-4 font-medium text-mm-text-secondary uppercase text-xs">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center p-8 text-mm-text-secondary">
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
                      className="border-b border-mm-border hover:bg-mm-dark/30"
                      data-testid={`product-row-${product.article}`}
                    >
                      <td className="p-4 font-mono text-sm text-mm-text">{product.article}</td>
                      <td className="p-4">
                        {product.photo ? (
                          <img
                            src={product.photo}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-mm-dark rounded flex items-center justify-center text-mm-text-secondary text-xs">
                            Нет фото
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="max-w-xs truncate text-mm-text">{product.name}</div>
                      </td>
                      <td className="p-4">
                        {product.ozon_linked ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">✅ Ozon</span>
                            {product.ozon?.price ? (
                              <div className="text-sm text-mm-text">
                                <span className="font-semibold">{formatPrice(product.ozon.price)}</span>
                                <span className="text-mm-text-secondary"> / {formatPrice(product.ozon.old_price)}</span>
                              </div>
                            ) : (
                              <div className="text-xs text-mm-text-secondary">Цены не установлены</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-mm-dark text-mm-text-secondary border border-mm-border">Не привязан</span>
                        )}
                      </td>
                      <td className="p-4">
                        {product.wb_linked ? (
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">✅ WB</span>
                            {product.wb?.regular_price ? (
                              <div className="text-sm text-mm-text">
                                <span className="font-semibold">{formatPrice(product.wb.discount_price || product.wb.regular_price)}</span>
                                {product.wb.discount_price && (
                                  <span className="text-mm-text-secondary"> / {formatPrice(product.wb.regular_price)}</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-mm-text-secondary">Цены не установлены</div>
                            )}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-1 text-xs rounded bg-mm-dark text-mm-text-secondary border border-mm-border">Не привязан</span>
                        )}
                      </td>
                      <td className="p-4">
                        {product.min_allowed_price ? (
                          <span className="text-sm font-medium text-mm-text">{formatPrice(product.min_allowed_price)}</span>
                        ) : (
                          <span className="text-mm-text-secondary">—</span>
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
                          className="px-3 py-1 text-sm bg-mm-dark text-mm-cyan border border-mm-border rounded hover:bg-mm-dark/80"
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