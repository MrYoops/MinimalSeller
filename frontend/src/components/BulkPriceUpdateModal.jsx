import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const BulkPriceUpdateModal = ({ products, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [marketplace, setMarketplace] = useState('all');
  const [action, setAction] = useState('increase_percent');
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('all');

  const backendUrl = process.env.REACT_APP_BACKEND_URL || '';

  // Calculate affected products
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
      const token = localStorage.getItem('token');
      
      const response = await fetch(
        `${backendUrl}/api/catalog/products/pricing/bulk`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action,
            value: parseFloat(value),
            marketplace,
            product_ids: scope === 'selected' ? products.map(p => p.product_id) : null
          })
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update prices');
      }

      const data = await response.json();
      toast.success(data.message);
      
      if (data.errors && data.errors.length > 0) {
        console.error('Some updates failed:', data.errors);
        toast.warning(`Ошибок: ${data.failed_count}`);
      }
      
      onUpdate();
    } catch (error) {
      console.error('Error bulk updating prices:', error);
      toast.error(error.message || 'Ошибка массового обновления');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = () => {
    switch (action) {
      case 'increase_percent':
        return 'Увеличить на %';
      case 'decrease_percent':
        return 'Уменьшить на %';
      case 'set_fixed':
        return 'Установить фиксированную';
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="bulk-price-modal">
      <Card className="w-full max-w-xl">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Массовое изменение цен
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Marketplace Selection */}
          <div className="space-y-2">
            <Label>Маркетплейс</Label>
            <RadioGroup value={marketplace} onValueChange={setMarketplace}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ozon" id="mp-ozon" />
                <Label htmlFor="mp-ozon" className="cursor-pointer">Ozon</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="wb" id="mp-wb" />
                <Label htmlFor="mp-wb" className="cursor-pointer">Wildberries</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="mp-all" />
                <Label htmlFor="mp-all" className="cursor-pointer">Оба маркетплейса</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Action Selection */}
          <div className="space-y-2">
            <Label>Действие</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger data-testid="action-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="increase_percent">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Увеличить на %
                  </div>
                </SelectItem>
                <SelectItem value="decrease_percent">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    Уменьшить на %
                  </div>
                </SelectItem>
                <SelectItem value="set_fixed">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Установить фиксированную цену
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label htmlFor="value">
              {action === 'set_fixed' ? 'Цена (₽)' : 'Процент (%)'}
            </Label>
            <Input
              id="value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={action === 'set_fixed' ? '1990' : '10'}
              data-testid="value-input"
            />
          </div>

          {/* Scope Selection */}
          <div className="space-y-2">
            <Label>Применить к</Label>
            <RadioGroup value={scope} onValueChange={setScope}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="scope-all" />
                <Label htmlFor="scope-all" className="cursor-pointer">Всем товарам</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="selected" id="scope-selected" />
                <Label htmlFor="scope-selected" className="cursor-pointer">
                  Выбранным товарам ({products.length})
                </Label>
              </div>
            </RadioGroup>
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
            <Button variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button
              onClick={handleApply}
              disabled={loading || !value || affectedCount === 0}
              className="flex-1"
              data-testid="apply-bulk-btn"
            >
              ✅ Применить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkPriceUpdateModal;