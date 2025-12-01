import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const PriceAlertBadge = ({ alerts }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  const handleResolve = async (alertId) => {
    try {
      setResolvingId(alertId);
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${backendUrl}/api/catalog/products/pricing/alerts/${alertId}/resolve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to resolve alert');

      toast.success('✅ Алерт отмечен как решённый');
      setShowDetails(false);
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
        className="relative"
        data-testid="alert-badge"
      >
        <Badge variant="destructive" className="animate-pulse">
          <AlertTriangle className="w-3 h-3 mr-1" />
          {alerts.length}
        </Badge>
      </button>

      {showDetails && (
        <div className="absolute right-0 top-8 z-50" style={{ minWidth: '320px' }}>
          <Card className="shadow-lg border-2 border-orange-200">
            <CardHeader className="pb-3 bg-orange-50">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-orange-900 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Алерты о ценах
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowDetails(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 space-y-2">
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
                        <span className="text-muted-foreground">Наша цена:</span>
                        <span className="font-semibold">{alert.our_min_price}₽</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Цена в акции:</span>
                        <span className="font-semibold text-red-600">
                          {alert.current_mp_price}₽ 🔴
                        </span>
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(alert._id)}
                      disabled={resolvingId === alert._id}
                      className="flex-1 h-7 text-xs"
                    >
                      ❌ Игнорировать
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setShowDetails(false)}
                      className="flex-1 h-7 text-xs"
                    >
                      🔧 Изменить цену
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PriceAlertBadge;