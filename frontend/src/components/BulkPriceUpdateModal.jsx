import React, { useState } from 'react';
import { FiX, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const BulkPriceUpdateModal = ({ products, onClose, onUpdate }) => {
  const { api } = useAuth();
  const [loading, setLoading] = useState(false);
  const [marketplace, setMarketplace] = useState('all');
  const [action, setAction] = useState('increase_percent');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('all');

  const getAffectedProducts = () => {
    let affected = products;
    
    if (marketplace === 'ozon') {
      affected = products.filter(p => p.ozon_linked);
    } else if (marketplace === 'wb') {
      affected = products.filter(p => p.wb_linked);
    }
    
    return affected;
  };

  const affectedCount = getAffectedProducts().length;

  const handleApply = async () => {
    if (!value || parseFloat(value) <= 0) {
      toast.error('Укажите корректное значение');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/api/catalog/products/pricing/bulk', {
        action,
        value: parseFloat(value),
        marketplace,
        product_ids: scope === 'selected' ? products.map(p => p.product_id) : null
      });
      
      toast.success(response.data.message);
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.error('Some updates failed:', response.data.errors);
        toast.warning(`Ошибок: ${response.data.failed_count}`);
      }
      
      onUpdate();
    } catch (error) {
      console.error('Error bulk updating prices:', error);
      toast.error(error.response?.data?.detail || 'Ошибка массового обновления');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = () => {
    switch (action) {
      case 'increase_percent': return 'Увеличить на %';
      case 'decrease_percent': return 'Уменьшить на %';
      case 'set_fixed': return 'Установить фиксированную';
      default: return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="bulk-price-modal">
      <div className="bg-white rounded-lg w-full max-w-xl">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FiDollarSign className="w-6 h-6" />
            Массовое изменение цен
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Marketplace Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Маркетплейс</label>
            <div className="space-y-2">
              {['ozon', 'wb', 'all'].map(mp => (
                <label key={mp} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={marketplace === mp}
                    onChange={() => setMarketplace(mp)}
                    className="w-4 h-4"
                  />
                  <span>{mp === 'ozon' ? 'Ozon' : mp === 'wb' ? 'Wildberries' : 'Оба маркетплейса'}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Действие</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="action-select"
            >
              <option value="increase_percent">📈 Увеличить на %</option>
              <option value="decrease_percent">📉 Уменьшить на %</option>
              <option value="set_fixed">💵 Установить фиксированную цену</option>
            </select>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              {action === 'set_fixed' ? 'Цена (₽)' : 'Процент (%)'}
            </label>
            <input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={action === 'set_fixed' ? '1990' : '10'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              data-testid="value-input"
            />
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Применить к</label>
            <div className="space-y-2">
              {['all', 'selected'].map(sc => (
                <label key={sc} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={scope === sc}
                    onChange={() => setScope(sc)}
                    className="w-4 h-4"
                  />
                  <span>{sc === 'all' ? 'Всем товарам' : `Выбранным товарам (${products.length})`}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm font-medium text-blue-900">
              ⚠️ Будет изменено: <span className="font-bold">{affectedCount}</span> товаров
            </p>
            {value && (
              <p className="text-sm text-blue-700 mt-1">
                Действие: {getActionLabel()} — {value}{action === 'set_fixed' ? '₽' : '%'}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              onClick={handleApply}
              disabled={loading || !value || affectedCount === 0}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
              data-testid="apply-bulk-btn"
            >
              ✅ Применить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPriceUpdateModal;