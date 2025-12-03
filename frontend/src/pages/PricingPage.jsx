import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiSave, FiCheck, FiDownload } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

// Editable price cell component
const EditablePrice = ({ value, onChange, suffix = '₽', placeholder = '—' }) => {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value || '');

  useEffect(() => {
    setLocalValue(value || '');
  }, [value]);

  const handleBlur = () => {
    setEditing(false);
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBlur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value || '');
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <input
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-20 px-2 py-1 bg-mm-dark border border-mm-cyan rounded text-mm-text text-sm focus:outline-none"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-mm-cyan/10 px-2 py-1 rounded transition-colors min-w-[60px] text-center border border-transparent hover:border-mm-cyan/30"
    >
      {value ? `${value}${suffix}` : placeholder}
    </div>
  );
};

// Current price display (read-only from marketplace)
const CurrentPrice = ({ value, suffix = '₽' }) => (
  <div className="text-mm-text-secondary text-center px-2 py-1 min-w-[60px]">
    {value ? `${value}${suffix}` : '—'}
  </div>
);

const PricingPage = () => {
  const { api } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingProduct, setSavingProduct] = useState(null);
  
  // Marketplace checkboxes state
  const [selectedMPs, setSelectedMPs] = useState({
    ozon: true,
    wb: true
  });

  // Local edits tracking
  const [localEdits, setLocalEdits] = useState({});

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
      setLocalEdits({});
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const syncFromMarketplaces = async () => {
    setSyncing(true);
    try {
      const response = await api.get('/api/catalog/pricing/sync-from-mp');
      if (response.data.success) {
        toast.success(`✅ ${response.data.message}`);
        await fetchProducts();
      } else {
        toast.error(response.data.message || 'Ошибка синхронизации');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Ошибка синхронизации с маркетплейсами');
    } finally {
      setSyncing(false);
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
    setSelectedMPs(prev => ({ ...prev, [mp]: !prev[mp] }));
  };

  const updateLocalEdit = (productId, field, value) => {
    setLocalEdits(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const getNewValue = (product, field) => {
    // Check local edits first
    if (localEdits[product.product_id]?.[field] !== undefined) {
      return localEdits[product.product_id][field];
    }
    return '';
  };

  const getCurrentValue = (product, field) => {
    // Parse field path like 'ozon.price'
    const parts = field.split('.');
    let val = product;
    for (const part of parts) {
      val = val?.[part];
    }
    return val || '';
  };

  const hasChanges = (productId) => {
    return localEdits[productId] && Object.keys(localEdits[productId]).length > 0;
  };

  const saveProduct = async (product) => {
    const edits = localEdits[product.product_id];
    if (!edits) return;

    setSavingProduct(product.product_id);
    try {
      const updates = {};
      
      if (edits.min_allowed_price) {
        updates.min_allowed_price = parseFloat(edits.min_allowed_price) || 0;
      }

      // Build Ozon updates
      if (product.ozon_linked && (edits['ozon.price'] || edits['ozon.old_price'] || edits['ozon.min_price'])) {
        updates.ozon = {
          price: parseFloat(edits['ozon.price']) || product.ozon?.price || 0,
          old_price: parseFloat(edits['ozon.old_price']) || product.ozon?.old_price || 0,
          min_price: parseFloat(edits['ozon.min_price']) || product.ozon?.min_price || 0
        };
      }

      // Build WB updates
      if (product.wb_linked && (edits['wb.regular_price'] || edits['wb.discount_price'] || edits['wb.discount'])) {
        updates.wb = {
          regular_price: parseFloat(edits['wb.regular_price']) || product.wb?.regular_price || 0,
          discount_price: parseFloat(edits['wb.discount_price']) || product.wb?.discount_price || 0,
          discount: parseFloat(edits['wb.discount']) || product.wb?.discount || 0
        };
      }

      await api.put(`/api/catalog/pricing/${product.product_id}`, updates);
      toast.success(`✅ Сохранено: ${product.article}`);
      
      // Clear local edits for this product and refresh
      setLocalEdits(prev => {
        const newEdits = { ...prev };
        delete newEdits[product.product_id];
        return newEdits;
      });
      fetchProducts();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Ошибка сохранения');
    } finally {
      setSavingProduct(null);
    }
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
        <div className="flex gap-2">
          <button
            onClick={syncFromMarketplaces}
            disabled={syncing}
            className="px-4 py-2 bg-mm-cyan text-mm-dark font-medium rounded hover:bg-mm-cyan/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiDownload className="w-4 h-4" />}
            Загрузить с МП
          </button>
        </div>
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

      {/* Products Table */}
      <div className="bg-mm-secondary rounded-lg border border-mm-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mm-dark">
              {/* Main header row */}
              <tr className="border-b border-mm-border">
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs" rowSpan="2">Фото</th>
                <th className="text-left p-3 font-medium text-mm-text-secondary uppercase text-xs" rowSpan="2">Товар</th>
                
                {/* Ozon columns */}
                {selectedMPs.ozon && (
                  <th className="text-center p-2 font-medium text-blue-400 uppercase text-xs border-l border-mm-border" colSpan="6">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">O</div>
                      Ozon
                    </div>
                  </th>
                )}
                
                {/* WB columns */}
                {selectedMPs.wb && (
                  <th className="text-center p-2 font-medium text-purple-400 uppercase text-xs border-l border-mm-border" colSpan="6">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 bg-purple-500 rounded flex items-center justify-center text-white text-xs font-bold">W</div>
                      Wildberries
                    </div>
                  </th>
                )}
                
                <th className="text-center p-3 font-medium text-mm-text-secondary uppercase text-xs border-l border-mm-border" rowSpan="2">Мин.<br/>цена</th>
                <th className="text-center p-3 font-medium text-mm-text-secondary uppercase text-xs" rowSpan="2" style={{width: '60px'}}></th>
              </tr>
              
              {/* Sub-headers for price types */}
              <tr className="border-b border-mm-border bg-mm-dark/70">
                {selectedMPs.ozon && (
                  <>
                    <th className="p-2 text-center text-xs text-blue-300/80 font-normal border-l border-mm-border" colSpan="2">Со скидкой</th>
                    <th className="p-2 text-center text-xs text-blue-300/80 font-normal" colSpan="2">До скидки</th>
                    <th className="p-2 text-center text-xs text-blue-300/80 font-normal" colSpan="2">Мин. цена</th>
                  </>
                )}
                {selectedMPs.wb && (
                  <>
                    <th className="p-2 text-center text-xs text-purple-300/80 font-normal border-l border-mm-border" colSpan="2">До скидки</th>
                    <th className="p-2 text-center text-xs text-purple-300/80 font-normal" colSpan="2">Со скидкой</th>
                    <th className="p-2 text-center text-xs text-purple-300/80 font-normal" colSpan="2">Скидка %</th>
                  </>
                )}
              </tr>
              
              {/* Current/New sub-headers */}
              <tr className="border-b border-mm-border bg-mm-dark/50">
                <th className="p-1"></th>
                <th className="p-1"></th>
                {selectedMPs.ozon && (
                  <>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal border-l border-mm-border">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                  </>
                )}
                {selectedMPs.wb && (
                  <>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal border-l border-mm-border">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                    <th className="p-1 text-center text-[10px] text-mm-text-secondary font-normal">Текущ.</th>
                    <th className="p-1 text-center text-[10px] text-mm-cyan font-normal">Новая</th>
                  </>
                )}
                <th className="p-1 border-l border-mm-border"></th>
                <th className="p-1"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="20" className="text-center p-8 text-mm-text-secondary">
                    Товары не найдены
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr
                    key={product.product_id}
                    className={`border-b border-mm-border hover:bg-mm-dark/30 transition-colors ${
                      hasChanges(product.product_id) ? 'bg-yellow-500/5' : ''
                    }`}
                  >
                    {/* Photo */}
                    <td className="p-2">
                      {product.photo ? (
                        <img src={product.photo} alt="" className="w-10 h-10 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-mm-dark rounded flex items-center justify-center">
                          <span className="text-xs text-mm-text-secondary">—</span>
                        </div>
                      )}
                    </td>
                    
                    {/* Article & Name */}
                    <td className="p-2">
                      <div className="font-mono text-sm text-mm-cyan">{product.article}</div>
                      <div className="text-xs text-mm-text-secondary truncate max-w-[150px]">{product.name}</div>
                    </td>
                    
                    {/* Ozon prices */}
                    {selectedMPs.ozon && (
                      <>
                        {/* Цена со скидкой */}
                        <td className="p-1 text-center border-l border-mm-border">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.price')} />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.price', v)}
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        
                        {/* Цена до скидки */}
                        <td className="p-1 text-center">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.old_price')} />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.old_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.old_price', v)}
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        
                        {/* Мин. цена */}
                        <td className="p-1 text-center">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.min_price')} />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.min_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.min_price', v)}
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                      </>
                    )}
                    
                    {/* WB prices */}
                    {selectedMPs.wb && (
                      <>
                        {/* Цена до скидки */}
                        <td className="p-1 text-center border-l border-mm-border">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.regular_price')} />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.regular_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.regular_price', v)}
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        
                        {/* Цена со скидкой */}
                        <td className="p-1 text-center">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.discount_price')} />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.discount_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.discount_price', v)}
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        
                        {/* Скидка % */}
                        <td className="p-1 text-center">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.discount')} suffix="%" />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="p-1 text-center">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.discount')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.discount', v)}
                              suffix="%"
                              placeholder=""
                            />
                          ) : (
                            <span className="text-mm-text-secondary text-xs">—</span>
                          )}
                        </td>
                      </>
                    )}
                    
                    {/* Min price */}
                    <td className="p-1 text-center border-l border-mm-border">
                      <EditablePrice
                        value={getNewValue(product, 'min_allowed_price') || getCurrentValue(product, 'min_allowed_price')}
                        onChange={(v) => updateLocalEdit(product.product_id, 'min_allowed_price', v)}
                      />
                    </td>
                    
                    {/* Save button */}
                    <td className="p-2 text-center">
                      {hasChanges(product.product_id) && (
                        <button
                          onClick={() => saveProduct(product)}
                          disabled={savingProduct === product.product_id}
                          className="px-2 py-1 bg-mm-cyan text-mm-dark text-xs font-medium rounded hover:bg-mm-cyan/90 transition-colors disabled:opacity-50"
                        >
                          {savingProduct === product.product_id ? (
                            <FiRefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <FiSave className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend */}
      <div className="text-xs text-mm-text-secondary space-y-1">
        <div>💡 <strong>Текущ.</strong> — актуальная цена на маркетплейсе (только чтение)</div>
        <div>💡 <strong>Новая</strong> — введите новое значение для обновления (кликните для редактирования)</div>
        <div>💡 Нажмите <strong>"Загрузить с МП"</strong> чтобы обновить текущие цены с маркетплейсов</div>
      </div>
    </div>
  );
};

export default PricingPage;
