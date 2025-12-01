import React, { useState, useEffect } from 'react';
import { X, DollarSign, TrendingUp, History, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const PriceEditModal = ({ product, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Ozon prices
  const [ozonPrice, setOzonPrice] = useState(product.ozon?.price || '');
  const [ozonOldPrice, setOzonOldPrice] = useState(product.ozon?.old_price || '');
  
  // WB prices
  const [wbRegularPrice, setWbRegularPrice] = useState(product.wb?.regular_price || '');
  const [wbDiscountPrice, setWbDiscountPrice] = useState(product.wb?.discount_price || '');
  
  // Settings
  const [minAllowedPrice, setMinAllowedPrice] = useState(product.min_allowed_price || '');
  const [costPrice, setCostPrice] = useState(product.cost_price || '');

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${backendUrl}/api/catalog/products/${product.product_id}/pricing/history?limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch history');

      const data = await response.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const calculateDiscount = (price, oldPrice) => {
    if (!price || !oldPrice || oldPrice === 0) return 0;
    return Math.round(((oldPrice - price) / oldPrice) * 100);
  };

  const handleSaveOzon = async () => {
    if (!product.ozon_linked) {
      toast.error('Товар не привязан к Ozon');
      return;
    }

    if (!ozonPrice || !ozonOldPrice) {
      toast.error('Заполните оба поля для Ozon');
      return;
    }

    if (parseFloat(ozonPrice) > parseFloat(ozonOldPrice)) {
      toast.error('Цена со скидкой не может быть больше цены без скидки');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${backendUrl}/api/catalog/products/${product.product_id}/pricing/ozon`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            marketplace: 'ozon',
            price: parseFloat(ozonPrice),
            old_price: parseFloat(ozonOldPrice)
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update prices');
      }

      toast.success('✅ Цены на Ozon обновлены');
      await fetchHistory();
    } catch (error) {
      console.error('Error updating Ozon prices:', error);
      toast.error(error.message || 'Ошибка обновления цен на Ozon');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveWB = async () => {
    if (!product.wb_linked) {
      toast.error('Товар не привязан к Wildberries');
      return;
    }

    if (!wbRegularPrice) {
      toast.error('Заполните обычную цену для WB');
      return;
    }

    if (wbDiscountPrice && parseFloat(wbDiscountPrice) > parseFloat(wbRegularPrice)) {
      toast.error('Цена со скидкой не может быть больше обычной цены');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${backendUrl}/api/catalog/products/${product.product_id}/pricing/wb`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            marketplace: 'wb',
            regular_price: parseFloat(wbRegularPrice),
            discount_price: wbDiscountPrice ? parseFloat(wbDiscountPrice) : null
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update prices');
      }

      toast.success('✅ Цены на Wildberries обновлены');
      await fetchHistory();
    } catch (error) {
      console.error('Error updating WB prices:', error);
      toast.error(error.message || 'Ошибка обновления цен на WB');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    if (product.ozon_linked && ozonPrice && ozonOldPrice) {
      await handleSaveOzon();
    }
    if (product.wb_linked && wbRegularPrice) {
      await handleSaveWB();
    }
    
    // Update min price and cost price in product
    // (This would need a separate endpoint, but for now we'll just close)
    
    onUpdate();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="price-edit-modal">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <DollarSign className="w-6 h-6" />
                Изменить цены
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {product.name} ({product.article})
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Ozon Section */}
          {product.ozon_linked && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                  📊 Ozon
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ozon-price">Цена со скидкой (₽)</Label>
                  <Input
                    id="ozon-price"
                    type="number"
                    value={ozonPrice}
                    onChange={(e) => setOzonPrice(e.target.value)}
                    placeholder="1990"
                    data-testid="ozon-price-input"
                  />
                </div>
                <div>
                  <Label htmlFor="ozon-old-price">Цена до скидки (₽)</Label>
                  <Input
                    id="ozon-old-price"
                    type="number"
                    value={ozonOldPrice}
                    onChange={(e) => setOzonOldPrice(e.target.value)}
                    placeholder="2490"
                    data-testid="ozon-old-price-input"
                  />
                </div>
              </div>
              {ozonPrice && ozonOldPrice && (
                <div className="text-sm text-muted-foreground">
                  Скидка: <span className="font-semibold text-green-600">
                    {calculateDiscount(ozonPrice, ozonOldPrice)}%
                  </span>
                </div>
              )}
              <Button
                onClick={handleSaveOzon}
                disabled={loading || !ozonPrice || !ozonOldPrice}
                className="w-full"
                data-testid="save-ozon-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить цены Ozon
              </Button>
            </div>
          )}

          {/* WB Section */}
          {product.wb_linked && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  📊 Wildberries
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wb-regular">Обычная цена (₽)</Label>
                  <Input
                    id="wb-regular"
                    type="number"
                    value={wbRegularPrice}
                    onChange={(e) => setWbRegularPrice(e.target.value)}
                    placeholder="2490"
                    data-testid="wb-regular-price-input"
                  />
                </div>
                <div>
                  <Label htmlFor="wb-discount">Цена со скидкой (₽)</Label>
                  <Input
                    id="wb-discount"
                    type="number"
                    value={wbDiscountPrice}
                    onChange={(e) => setWbDiscountPrice(e.target.value)}
                    placeholder="1990"
                    data-testid="wb-discount-price-input"
                  />
                </div>
              </div>
              {wbDiscountPrice && wbRegularPrice && (
                <div className="text-sm text-muted-foreground">
                  Скидка: <span className="font-semibold text-green-600">
                    {calculateDiscount(wbDiscountPrice, wbRegularPrice)}%
                  </span>
                </div>
              )}
              <Button
                onClick={handleSaveWB}
                disabled={loading || !wbRegularPrice}
                className="w-full"
                data-testid="save-wb-btn"
              >
                <Save className="w-4 h-4 mr-2" />
                Сохранить цены WB
              </Button>
            </div>
          )}

          {/* Settings Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              ⚙️ Настройки
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="min-price">Мин. допустимая цена (₽)</Label>
                <Input
                  id="min-price"
                  type="number"
                  value={minAllowedPrice}
                  onChange={(e) => setMinAllowedPrice(e.target.value)}
                  placeholder="1500"
                  data-testid="min-price-input"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Для алертов о слишком низких ценах
                </p>
              </div>
              <div>
                <Label htmlFor="cost-price">Себестоимость (₽)</Label>
                <Input
                  id="cost-price"
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="1000"
                  data-testid="cost-price-input"
                />
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              <History className="w-4 h-4" />
              История изменений (последние 5)
            </h3>
            {loadingHistory ? (
              <div className="text-center text-muted-foreground py-4">Загрузка...</div>
            ) : history.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">История пуста</div>
            ) : (
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div
                    key={idx}
                    className="text-sm p-3 bg-muted/30 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{formatDate(entry.timestamp)}</span>
                      <span className="text-muted-foreground ml-2">
                        {entry.marketplace === 'ozon' ? '📊 Ozon' : '📊 WB'}
                      </span>
                    </div>
                    <div className="text-right">
                      {entry.marketplace === 'ozon' ? (
                        <span>
                          {entry.new_price}₽ / {entry.new_old_price}₽
                        </span>
                      ) : (
                        <span>
                          {entry.new_discount_price || entry.new_regular_price}₽
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={loading}
              className="flex-1"
              data-testid="save-all-btn"
            >
              <Save className="w-4 h-4 mr-2" />
              💾 Сохранить и отправить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PriceEditModal;