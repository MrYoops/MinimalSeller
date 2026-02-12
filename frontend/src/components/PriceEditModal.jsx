import React, { useState, useEffect } from 'react';
import { FiX, FiDollarSign, FiClock, FiSave } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const PriceEditModal = ({ product, onClose, onUpdate }) => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState([]);
  
  const [ozonPrice, setOzonPrice] = useState(product.ozon?.price || '');
  const [ozonOldPrice, setOzonOldPrice] = useState(product.ozon?.old_price || '');
  const [wbRegularPrice, setWbRegularPrice] = useState(product.wb?.regular_price || '');
  const [wbDiscountPrice, setWbDiscountPrice] = useState(product.wb?.discount_price || '');
  const [minAllowedPrice, setMinAllowedPrice] = useState(product.min_allowed_price || '');
  const [costPrice, setCostPrice] = useState(product.cost_price || '');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await api.get(`/api/catalog/pricing/${product.product_id}/history?limit=5`);
      setHistory(response.data.history || []);
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
      await api.put(`/api/catalog/pricing/${product.product_id}/ozon`, {
        marketplace: 'ozon',
        price: parseFloat(ozonPrice),
        old_price: parseFloat(ozonOldPrice)
      });
      toast.success('✅ Цены на Ozon обновлены');
      await fetchHistory();
    } catch (error) {
      console.error('Error updating Ozon prices:', error);
      toast.error(error.response?.data?.detail || 'Ошибка обновления цен на Ozon');
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
      await api.put(`/api/catalog/pricing/${product.product_id}/wb`, {
        marketplace: 'wb',
        regular_price: parseFloat(wbRegularPrice),
        discount_price: wbDiscountPrice ? parseFloat(wbDiscountPrice) : null
      });
      toast.success('✅ Цены на Wildberries обновлены');
      await fetchHistory();
    } catch (error) {
      console.error('Error updating WB prices:', error);
      toast.error(error.response?.data?.detail || 'Ошибка обновления цен на WB');
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
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FiDollarSign className="w-6 h-6" />
              Изменить цены
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {product.name} ({product.article})
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Ozon Section */}
          {product.ozon_linked && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded bg-blue-100 text-blue-800">📊 Ozon</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Цена со скидкой (₽)</label>
                  <input
                    type="number"
                    value={ozonPrice}
                    onChange={(e) => setOzonPrice(e.target.value)}
                    placeholder="1990"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="ozon-price-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Цена до скидки (₽)</label>
                  <input
                    type="number"
                    value={ozonOldPrice}
                    onChange={(e) => setOzonOldPrice(e.target.value)}
                    placeholder="2490"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="ozon-old-price-input"
                  />
                </div>
              </div>
              {ozonPrice && ozonOldPrice && (
                <div className="text-sm text-gray-600">
                  Скидка: <span className="font-semibold text-green-600">{calculateDiscount(ozonPrice, ozonOldPrice)}%</span>
                </div>
              )}
              <button
                onClick={handleSaveOzon}
                disabled={loading || !ozonPrice || !ozonOldPrice}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                data-testid="save-ozon-btn"
              >
                <FiSave className="w-4 h-4" />
                Сохранить цены Ozon
              </button>
            </div>
          )}

          {/* WB Section */}
          {product.wb_linked && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 text-sm rounded bg-purple-100 text-purple-800">📊 Wildberries</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Обычная цена (₽)</label>
                  <input
                    type="number"
                    value={wbRegularPrice}
                    onChange={(e) => setWbRegularPrice(e.target.value)}
                    placeholder="2490"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="wb-regular-price-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Цена со скидкой (₽)</label>
                  <input
                    type="number"
                    value={wbDiscountPrice}
                    onChange={(e) => setWbDiscountPrice(e.target.value)}
                    placeholder="1990"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    data-testid="wb-discount-price-input"
                  />
                </div>
              </div>
              {wbDiscountPrice && wbRegularPrice && (
                <div className="text-sm text-gray-600">
                  Скидка: <span className="font-semibold text-green-600">{calculateDiscount(wbDiscountPrice, wbRegularPrice)}%</span>
                </div>
              )}
              <button
                onClick={handleSaveWB}
                disabled={loading || !wbRegularPrice}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
                data-testid="save-wb-btn"
              >
                <FiSave className="w-4 h-4" />
                Сохранить цены WB
              </button>
            </div>
          )}

          {/* Settings Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold">⚙️ Настройки</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Мин. допустимая цена (₽)</label>
                <input
                  type="number"
                  value={minAllowedPrice}
                  onChange={(e) => setMinAllowedPrice(e.target.value)}
                  placeholder="1500"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  data-testid="min-price-input"
                />
                <p className="text-xs text-gray-500 mt-1">Для алертов о слишком низких ценах</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Себестоимость (₽)</label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="1000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  data-testid="cost-price-input"
                />
              </div>
            </div>
          </div>

          {/* History Section */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              <FiClock className="w-4 h-4" />
              История изменений (последние 5)
            </h3>
            {loadingHistory ? (
              <div className="text-center text-gray-500 py-4">Загрузка...</div>
            ) : history.length === 0 ? (
              <div className="text-center text-gray-500 py-4">История пуста</div>
            ) : (
              <div className="space-y-2">
                {history.map((entry, idx) => (
                  <div key={idx} className="text-sm p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                    <div>
                      <span className="font-medium">{formatDate(entry.timestamp)}</span>
                      <span className="text-gray-600 ml-2">
                        {entry.marketplace === 'ozon' ? '📊 Ozon' : '📊 WB'}
                      </span>
                    </div>
                    <div className="text-right">
                      {entry.marketplace === 'ozon' ? (
                        <span>{entry.new_price}₽ / {entry.new_old_price}₽</span>
                      ) : (
                        <span>{entry.new_discount_price || entry.new_regular_price}₽</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              onClick={handleSaveAll}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
              data-testid="save-all-btn"
            >
              <FiSave className="w-4 h-4" />
              💾 Сохранить и отправить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PriceEditModal;