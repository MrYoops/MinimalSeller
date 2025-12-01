import React, { useState } from 'react';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const PriceAlertBadge = ({ alerts, onUpdate }) => {
  const { api } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const handleResolve = async (alertId) => {
    try {
      setResolvingId(alertId);
      await api.post(`/api/catalog/products/pricing/alerts/${alertId}/resolve`);
      toast.success('✅ Алерт отмечен как решённый');
      setShowDetails(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Ошибка решения алерта');
    } finally {
      setResolvingId(null);
    }
  };

  if (alerts.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium animate-pulse flex items-center gap-1"
        data-testid="alert-badge"
      >
        <FiAlertTriangle className="w-3 h-3" />
        {alerts.length}
      </button>

      {showDetails && (
        <div className="absolute right-0 top-8 z-50 min-w-[320px]">
          <div className="bg-white rounded-lg shadow-xl border-2 border-orange-200">
            <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
              <h4 className="text-sm font-semibold text-orange-900 flex items-center gap-1">
                <FiAlertTriangle className="w-4 h-4" />
                Алерты о ценах
              </h4>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-orange-100 rounded"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert._id}
                  className="p-3 bg-orange-50 border border-orange-200 rounded-lg space-y-2"
                  data-testid={`alert-detail-${alert._id}`}
                >
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-orange-900">
                      {alert.marketplace === 'ozon' ? '📊 Ozon' : '📊 Wildberries'}
                    </p>
                    <div className="text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Наша цена:</span>
                        <span className="font-semibold">{alert.our_min_price}₽</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Цена в акции:</span>
                        <span className="font-semibold text-red-600">{alert.current_mp_price}₽ 🔴</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-orange-800">
                    ⚠️ Товар продается по цене НИЖЕ вашей минимальной! Возможен убыток.
                  </p>
                  {alert.is_in_promo && alert.promo_name && (
                    <p className="text-xs font-medium text-purple-700">
                      🎉 Акция: {alert.promo_name}
                    </p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleResolve(alert._id)}
                      disabled={resolvingId === alert._id}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:bg-gray-100"
                    >
                      ❌ Игнорировать
                    </button>
                    <button
                      onClick={() => setShowDetails(false)}
                      className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      🔧 Изменить цену
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceAlertBadge;