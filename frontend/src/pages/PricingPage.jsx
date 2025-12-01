import React, { useState, useEffect } from 'react';
import { Search, Filter, DollarSign, TrendingUp, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import PriceEditModal from '../components/PriceEditModal';
import BulkPriceUpdateModal from '../components/BulkPriceUpdateModal';
import PriceAlertBadge from '../components/PriceAlertBadge';

const PricingPage = () => {
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
  const [selectedProducts, setSelectedProducts] = useState([]);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

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
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/catalog/products/pricing`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${backendUrl}/api/catalog/products/pricing/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch alerts');

      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.article?.toLowerCase().includes(query) ||
        p.name?.toLowerCase().includes(query)
      );
    }

    // Фильтр по маркетплейсу
    if (marketplaceFilter !== 'all') {
      filtered = filtered.filter(p => p[`${marketplaceFilter}_linked`]);
    }

    // Фильтр по алертам
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
      const token = localStorage.getItem('token');
      let successCount = 0;
      
      for (const product of products) {
        try {
          const response = await fetch(
            `${backendUrl}/api/catalog/products/${product.product_id}/pricing/sync`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          if (response.ok) successCount++;
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
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Загрузка цен...</p>
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
            <DollarSign className="w-8 h-8" />
            Управление ценами
          </h1>
          <p className="text-muted-foreground mt-1">
            Управляйте ценами товаров на маркетплейсах
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleSyncAll}
            data-testid="sync-all-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Синхронизировать все
          </Button>
          <Button
            onClick={() => setShowBulkModal(true)}
            data-testid="bulk-update-btn"
          >
            <Settings className="w-4 h-4 mr-2" />
            Массовые операции
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Всего товаров
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              На Ozon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.ozon_linked).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              На Wildberries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.wb_linked).length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">
              Алерты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {alerts.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по артикулу или названию..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="search-input"
                />
              </div>
            </div>

            <Select value={marketplaceFilter} onValueChange={setMarketplaceFilter}>
              <SelectTrigger className="w-[200px]" data-testid="marketplace-filter">
                <SelectValue placeholder="Маркетплейс" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все маркетплейсы</SelectItem>
                <SelectItem value="ozon">Только Ozon</SelectItem>
                <SelectItem value="wb">Только WB</SelectItem>
              </SelectContent>
            </Select>

            <Select value={alertFilter} onValueChange={setAlertFilter}>
              <SelectTrigger className="w-[200px]" data-testid="alert-filter">
                <SelectValue placeholder="Алерты" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все товары</SelectItem>
                <SelectItem value="with_alerts">С алертами</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium">Артикул</th>
                  <th className="text-left p-4 font-medium">Фото</th>
                  <th className="text-left p-4 font-medium">Название</th>
                  <th className="text-left p-4 font-medium">Ozon</th>
                  <th className="text-left p-4 font-medium">Wildberries</th>
                  <th className="text-left p-4 font-medium">Мин. цена</th>
                  <th className="text-center p-4 font-medium">⚠️</th>
                  <th className="text-right p-4 font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center p-8 text-muted-foreground">
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
                        className="border-b hover:bg-muted/30 transition-colors"
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
                            <div className="w-12 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
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
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  ✅ Ozon
                                </Badge>
                              </div>
                              {product.ozon?.price ? (
                                <div className="text-sm">
                                  <span className="font-semibold">{formatPrice(product.ozon.price)}</span>
                                  <span className="text-muted-foreground"> / {formatPrice(product.ozon.old_price)}</span>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Цены не установлены</div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Не привязан</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {product.wb_linked ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                  ✅ WB
                                </Badge>
                              </div>
                              {product.wb?.regular_price ? (
                                <div className="text-sm">
                                  <span className="font-semibold">{formatPrice(product.wb.discount_price || product.wb.regular_price)}</span>
                                  {product.wb.discount_price && (
                                    <span className="text-muted-foreground"> / {formatPrice(product.wb.regular_price)}</span>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Цены не установлены</div>
                              )}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Не привязан</Badge>
                          )}
                        </td>
                        <td className="p-4">
                          {product.min_allowed_price ? (
                            <span className="text-sm font-medium">{formatPrice(product.min_allowed_price)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          {hasAlerts && (
                            <PriceAlertBadge alerts={productAlerts} />
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditPrice(product)}
                            data-testid={`edit-price-btn-${product.article}`}
                          >
                            📝 Изменить
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
          products={selectedProducts.length > 0 ? selectedProducts : products}
          onClose={() => setShowBulkModal(false)}
          onUpdate={handleBulkUpdate}
        />
      )}
    </div>
  );
};

export default PricingPage;