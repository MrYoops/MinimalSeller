import React, { useState, useEffect } from 'react';
import { FiSearch, FiDollarSign, FiSettings, FiRefreshCw, FiSave, FiX, FiCheck, FiAlertTriangle, FiPercent } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

// Price field component for inline editing
const PriceField = ({ label, value, onChange, disabled, suffix = '₽' }) => (
  <div className="flex flex-col">
    <label className="text-xs text-mm-text-secondary mb-1">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text text-sm focus:border-mm-cyan outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        placeholder="0"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-mm-text-secondary text-sm">{suffix}</span>
    </div>
  </div>
);

// Product row with expandable price editing
const ProductPriceRow = ({ product, selectedMPs, onSave, onRefresh }) => {
  const { api } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Local state for prices
  const [ozonPrices, setOzonPrices] = useState({
    price: product.ozon?.price || '',
    old_price: product.ozon?.old_price || '',
    min_price: product.ozon?.min_price || product.min_allowed_price || ''
  });
  
  const [wbPrices, setWbPrices] = useState({
    price: product.wb?.regular_price || '',
    discount_price: product.wb?.discount_price || '',
    discount: product.wb?.discount || ''
  });
  
  const [minPrice, setMinPrice] = useState(product.min_allowed_price || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        min_allowed_price: parseFloat(minPrice) || 0
      };
      
      if (selectedMPs.ozon && product.ozon_linked) {
        updates.ozon = {
          price: parseFloat(ozonPrices.price) || 0,
          old_price: parseFloat(ozonPrices.old_price) || 0,
          min_price: parseFloat(ozonPrices.min_price) || 0
        };
      }
      
      if (selectedMPs.wb && product.wb_linked) {
        updates.wb = {
          regular_price: parseFloat(wbPrices.price) || 0,
          discount_price: parseFloat(wbPrices.discount_price) || 0,
          discount: parseFloat(wbPrices.discount) || 0
        };
      }
      
      await api.put(`/api/catalog/pricing/${product.product_id}`, updates);
      toast.success(`Цены сохранены: ${product.article}`);
      setExpanded(false);
      onRefresh();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения цен');
    } finally {
      setSaving(false);
    }
  };
  
  // Calculate margin
  const calculateMargin = (sellPrice, costPrice) => {
    if (!sellPrice || !costPrice) return null;
    const margin = ((sellPrice - costPrice) / sellPrice) * 100;
    return margin.toFixed(1);
  };

  const ozonMargin = calculateMargin(ozonPrices.price, product.cost_price);
  const wbMargin = calculateMargin(wbPrices.discount_price || wbPrices.price, product.cost_price);

  return (
    <>
      {/* Main Row */}
      <tr 
        className={`border-b border-mm-border hover:bg-mm-dark/30 cursor-pointer transition-colors ${expanded ? 'bg-mm-dark/50' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Photo */}
        <td className="p-3">
          {product.photo ? (
            <img src={product.photo} alt="" className="w-10 h-10 object-cover rounded" />
          ) : (
            <div className="w-10 h-10 bg-mm-dark rounded flex items-center justify-center">
              <span className="text-xs text-mm-text-secondary">—</span>
            </div>
          )}
        </td>
        
        {/* Article & Name */}
        <td className="p-3">
          <div className="font-mono text-sm text-mm-cyan">{product.article}</div>
          <div className="text-xs text-mm-text-secondary truncate max-w-[200px]">{product.name}</div>
        </td>
        
        {/* Ozon prices (if selected) */}
        {selectedMPs.ozon && (
          <td className="p-3">
            {product.ozon_linked ? (
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-mm-text font-medium">{product.ozon?.price || '—'}₽</span>
                  {product.ozon?.old_price && (
                    <span className="text-mm-text-secondary line-through text-xs">{product.ozon.old_price}₽</span>
                  )}
                </div>
                {ozonMargin && (
                  <div className={`text-xs ${parseFloat(ozonMargin) > 20 ? 'text-green-400' : parseFloat(ozonMargin) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    Маржа: {ozonMargin}%
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-mm-text-secondary">Не привязан</span>
            )}
          </td>
        )}
        
        {/* WB prices (if selected) */}
        {selectedMPs.wb && (
          <td className="p-3">
            {product.wb_linked ? (
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-mm-text font-medium">{product.wb?.discount_price || product.wb?.regular_price || '—'}₽</span>
                  {product.wb?.discount && (
                    <span className="text-purple-400 text-xs">-{product.wb.discount}%</span>
                  )}
                </div>
                {wbMargin && (
                  <div className={`text-xs ${parseFloat(wbMargin) > 20 ? 'text-green-400' : parseFloat(wbMargin) > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                    Маржа: {wbMargin}%
                  </div>
                )}
              </div>
            ) : (
              <span className="text-xs text-mm-text-secondary">Не привязан</span>
            )}
          </td>
        )}
        
        {/* Min price */}
        <td className="p-3">
          <span className="text-sm text-mm-text">{product.min_allowed_price || '—'}₽</span>
        </td>
        
        {/* Cost price */}
        <td className="p-3">
          <span className="text-sm text-mm-text-secondary">{product.cost_price || '—'}₽</span>
        </td>
        
        {/* Actions */}
        <td className="p-3 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="px-3 py-1.5 text-sm bg-mm-gray text-mm-text border border-mm-border rounded hover:border-mm-cyan transition-colors"
          >
            {expanded ? 'Свернуть' : 'Изменить'}
          </button>
        </td>
      </tr>
      
      {/* Expanded Edit Row */}
      {expanded && (
        <tr className="bg-mm-dark/30 border-b border-mm-border">
          <td colSpan="7" className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Ozon Prices */}
              {selectedMPs.ozon && product.ozon_linked && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">O</div>
                    <span className="font-medium text-blue-400">Ozon</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceField 
                      label="Цена со скидкой" 
                      value={ozonPrices.price} 
                      onChange={(v) => setOzonPrices({...ozonPrices, price: v})} 
                    />
                    <PriceField 
                      label="Цена до скидки" 
                      value={ozonPrices.old_price} 
                      onChange={(v) => setOzonPrices({...ozonPrices, old_price: v})} 
                    />
                    <PriceField 
                      label="Мин. цена (Ozon)" 
                      value={ozonPrices.min_price} 
                      onChange={(v) => setOzonPrices({...ozonPrices, min_price: v})} 
                    />
                    <div className="flex flex-col">
                      <label className="text-xs text-mm-text-secondary mb-1">Комиссия</label>
                      <div className="px-3 py-2 bg-mm-dark/50 border border-mm-border rounded text-sm text-mm-text-secondary">
                        ~45% FBO/FBS
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* WB Prices */}
              {selectedMPs.wb && product.wb_linked && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                    <span className="font-medium text-purple-400">Wildberries</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <PriceField 
                      label="Цена до скидки" 
                      value={wbPrices.price} 
                      onChange={(v) => setWbPrices({...wbPrices, price: v})} 
                    />
                    <PriceField 
                      label="Цена со скидкой" 
                      value={wbPrices.discount_price} 
                      onChange={(v) => setWbPrices({...wbPrices, discount_price: v})} 
                    />
                    <PriceField 
                      label="Скидка" 
                      value={wbPrices.discount} 
                      onChange={(v) => setWbPrices({...wbPrices, discount: v})} 
                      suffix="%"
                    />
                    <div className="flex flex-col">
                      <label className="text-xs text-mm-text-secondary mb-1">Клубная цена</label>
                      <div className="px-3 py-2 bg-mm-dark/50 border border-mm-border rounded text-sm text-mm-text-secondary">
                        Авто
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* General Settings */}
              <div className="bg-mm-secondary border border-mm-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <FiSettings className="w-5 h-5 text-mm-cyan" />
                  <span className="font-medium text-mm-text">Общие настройки</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <PriceField 
                    label="Минимальная цена" 
                    value={minPrice} 
                    onChange={setMinPrice} 
                  />
                  <div className="flex flex-col">
                    <label className="text-xs text-mm-text-secondary mb-1">Себестоимость</label>
                    <div className="px-3 py-2 bg-mm-dark/50 border border-mm-border rounded text-sm text-mm-text">
                      {product.cost_price || 0}₽
                    </div>
                  </div>
                </div>
                
                {/* Save Button */}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setExpanded(false)}
                    className="px-4 py-2 bg-mm-dark text-mm-text-secondary border border-mm-border rounded hover:bg-mm-gray transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-mm-cyan text-mm-dark font-medium rounded hover:bg-mm-cyan/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiSave className="w-4 h-4" />}
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

const PricingPage = () => {
  const { api } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Marketplace checkboxes state
  const [selectedMPs, setSelectedMPs] = useState({
    ozon: true,
    wb: true
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, searchQuery]);

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

  const applyFilters = () => {
    let filtered = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.article?.toLowerCase().includes(query) ||
        p.name?.toLowerCase().includes(query)
      );
    }

    setFilteredProducts(filtered);
  };

  const handleMPToggle = (mp) => {
    setSelectedMPs(prev => ({
      ...prev,
      [mp]: !prev[mp]
    }));
  };

  // Stats
  const ozonCount = products.filter(p => p.ozon_linked).length;
  const wbCount = products.filter(p => p.wb_linked).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiRefreshCw className="w-8 h-8 animate-spin text-mm-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pricing-page">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-mm-cyan">ЦЕНЫ</h1>
          <p className="text-sm text-mm-text-secondary mt-1">Управление ценами на маркетплейсах</p>
        </div>
        <button
          onClick={fetchProducts}
          className="px-4 py-2 bg-mm-secondary text-mm-text border border-mm-border rounded hover:border-mm-cyan transition-colors flex items-center gap-2"
        >
          <FiRefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Marketplace Checkboxes */}
      <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-sm text-mm-text-secondary">Показать колонки:</span>
          
          {/* Ozon checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={selectedMPs.ozon}
                onChange={() => handleMPToggle('ozon')}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedMPs.ozon 
                  ? 'bg-blue-500 border-blue-500' 
                  : 'bg-mm-dark border-mm-border group-hover:border-blue-500'
              }`}>
                {selectedMPs.ozon && <FiCheck className="w-3 h-3 text-white" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">O</div>
              <span className="text-mm-text">Ozon</span>
              <span className="text-xs text-mm-text-secondary">({ozonCount})</span>
            </div>
          </label>
          
          {/* WB checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={selectedMPs.wb}
                onChange={() => handleMPToggle('wb')}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selectedMPs.wb 
                  ? 'bg-purple-500 border-purple-500' 
                  : 'bg-mm-dark border-mm-border group-hover:border-purple-500'
              }`}>
                {selectedMPs.wb && <FiCheck className="w-3 h-3 text-white" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-purple-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
              <span className="text-mm-text">Wildberries</span>
              <span className="text-xs text-mm-text-secondary">({wbCount})</span>
            </div>
          </label>
          
          {/* Search */}
          <div className="flex-1 min-w-[200px] ml-auto">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mm-text-secondary" />
              <input
                type="text"
                placeholder="Поиск по артикулу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-mm-dark border border-mm-border rounded text-mm-text text-sm focus:border-mm-cyan outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Price Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {selectedMPs.ozon && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center text-white font-bold">O</div>
              <div>
                <div className="font-medium text-blue-400">Ozon</div>
                <div className="text-xs text-mm-text-secondary">Привязано товаров: {ozonCount}</div>
              </div>
            </div>
            <div className="text-xs text-mm-text-secondary space-y-1">
              <div>• <strong>Цена со скидкой</strong> — текущая цена для покупателя</div>
              <div>• <strong>Цена до скидки</strong> — зачёркнутая цена</div>
              <div>• <strong>Мин. цена</strong> — ниже которой нельзя опустить</div>
            </div>
          </div>
        )}
        
        {selectedMPs.wb && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center text-white font-bold">W</div>
              <div>
                <div className="font-medium text-purple-400">Wildberries</div>
                <div className="text-xs text-mm-text-secondary">Привязано товаров: {wbCount}</div>
              </div>
            </div>
            <div className="text-xs text-mm-text-secondary space-y-1">
              <div>• <strong>Цена до скидки</strong> — базовая цена товара</div>
              <div>• <strong>Цена со скидкой</strong> — цена после применения скидки</div>
              <div>• <strong>Скидка %</strong> — процент скидки продавца</div>
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-mm-secondary rounded-lg border border-mm-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-mm-dark border-b border-mm-border">
              <tr>
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs w-12">Фото</th>
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs">Товар</th>
                {selectedMPs.ozon && (
                  <th className="text-left p-3 font-medium text-blue-400 uppercase text-xs">Ozon</th>
                )}
                {selectedMPs.wb && (
                  <th className="text-left p-3 font-medium text-purple-400 uppercase text-xs">Wildberries</th>
                )}
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs">Мин. цена</th>
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs">Себест.</th>
                <th className="text-right p-3 font-medium text-mm-text-secondary uppercase text-xs w-24">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-8 text-mm-text-secondary">
                    Товары не найдены
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <ProductPriceRow
                    key={product.product_id}
                    product={product}
                    selectedMPs={selectedMPs}
                    onRefresh={fetchProducts}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
