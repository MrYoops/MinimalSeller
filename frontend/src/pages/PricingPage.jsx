import React, { useState, useEffect } from 'react';
import { FiSearch, FiRefreshCw, FiSave, FiCheck, FiDownload, FiPercent, FiUpload, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

// Editable price cell component - with visible input field style
const EditablePrice = ({ value, onChange, suffix = '₽' }) => {
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
        className="w-[70px] px-2 py-1 bg-mm-dark border-2 border-mm-cyan rounded text-mm-cyan text-sm focus:outline-none text-center"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      className="cursor-pointer px-1 py-1 rounded transition-all min-w-[70px] text-center bg-mm-dark border border-dashed border-mm-border hover:border-mm-cyan hover:bg-mm-dark/80"
    >
      {value ? (
        <span className="text-mm-cyan font-medium text-sm">{value}{suffix}</span>
      ) : (
        <span className="text-mm-text-secondary/40 text-xs">ввести</span>
      )}
    </div>
  );
};

// Current price display (read-only from marketplace)
const CurrentPrice = ({ value, suffix = '₽' }) => (
  <div className="text-mm-text text-center px-1 py-1 min-w-[70px] font-medium text-sm">
    {value ? `${value}${suffix}` : '—'}
  </div>
);

// Commission display
const CommissionBadge = ({ fbo, fbs }) => {
  if (!fbo && !fbs) return <span className="text-mm-text-secondary text-xs">—</span>;
  return (
    <div className="text-xs text-center">
      <span className="text-orange-400">{fbo || fbs}%</span>
    </div>
  );
};

const PricingPage = () => {
  const { api } = useAuth();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [savingProduct, setSavingProduct] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  
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
      setSelectedProducts(new Set());
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

  const pushToMarketplaces = async () => {
    // Collect products with changes
    const productsWithChanges = filteredProducts.filter(p => 
      selectedProducts.has(p.product_id) && hasChanges(p.product_id)
    );
    
    if (productsWithChanges.length === 0) {
      toast.error('Выберите товары с изменениями для отправки');
      return;
    }
    
    setPushing(true);
    try {
      // Build prices payload
      const prices = {};
      for (const product of productsWithChanges) {
        const edits = localEdits[product.product_id] || {};
        prices[product.product_id] = {
          ozon: product.ozon_linked ? {
            price: parseFloat(edits['ozon.price']) || product.ozon?.price || 0,
            old_price: parseFloat(edits['ozon.old_price']) || product.ozon?.old_price || 0,
            min_price: parseFloat(edits['ozon.min_price']) || product.ozon?.min_price || 0
          } : null,
          wb: product.wb_linked ? {
            regular_price: parseFloat(edits['wb.regular_price']) || product.wb?.regular_price || 0,
            discount_price: parseFloat(edits['wb.discount_price']) || product.wb?.discount_price || 0,
            discount: parseFloat(edits['wb.discount']) || product.wb?.discount || 0
          } : null
        };
      }
      
      const response = await api.post('/api/catalog/pricing/push-to-mp', {
        product_ids: productsWithChanges.map(p => p.product_id),
        prices: prices
      });
      
      if (response.data.success) {
        const { results } = response.data;
        let message = '✅ ';
        if (results.ozon.success > 0) message += `Ozon: ${results.ozon.success} `;
        if (results.wb.success > 0) message += `WB: ${results.wb.success} `;
        toast.success(message || response.data.message);
        
        // Show errors if any
        if (results.ozon.errors?.length > 0) {
          toast.error(`Ozon ошибки: ${results.ozon.errors.join(', ')}`);
        }
        if (results.wb.errors?.length > 0) {
          toast.error(`WB ошибки: ${results.wb.errors.join(', ')}`);
        }
        
        // Refresh data
        await fetchProducts();
      } else {
        toast.error(response.data.message || 'Ошибка отправки');
      }
    } catch (error) {
      console.error('Push error:', error);
      toast.error('Ошибка отправки цен на маркетплейсы');
    } finally {
      setPushing(false);
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

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllWithChanges = () => {
    const productsWithChanges = filteredProducts.filter(p => hasChanges(p.product_id));
    setSelectedProducts(new Set(productsWithChanges.map(p => p.product_id)));
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
    if (localEdits[product.product_id]?.[field] !== undefined) {
      return localEdits[product.product_id][field];
    }
    return '';
  };

  const getCurrentValue = (product, field) => {
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
      
      if (edits.cost_price) {
        updates.cost_price = parseFloat(edits.cost_price) || 0;
      }

      if (product.ozon_linked && (edits['ozon.price'] || edits['ozon.old_price'] || edits['ozon.min_price'])) {
        updates.ozon = {
          price: parseFloat(edits['ozon.price']) || product.ozon?.price || 0,
          old_price: parseFloat(edits['ozon.old_price']) || product.ozon?.old_price || 0,
          min_price: parseFloat(edits['ozon.min_price']) || product.ozon?.min_price || 0
        };
      }

      if (product.wb_linked && (edits['wb.regular_price'] || edits['wb.discount_price'] || edits['wb.discount'])) {
        updates.wb = {
          regular_price: parseFloat(edits['wb.regular_price']) || product.wb?.regular_price || 0,
          discount_price: parseFloat(edits['wb.discount_price']) || product.wb?.discount_price || 0,
          discount: parseFloat(edits['wb.discount']) || product.wb?.discount || 0
        };
      }

      await api.put(`/api/catalog/pricing/${product.product_id}`, updates);
      toast.success(`✅ Сохранено: ${product.article}`);
      
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

  const ozonCount = products.filter(p => p.ozon_linked).length;
  const wbCount = products.filter(p => p.wb_linked).length;
  const changesCount = Object.keys(localEdits).length;
  const selectedCount = selectedProducts.size;

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
            className="px-4 py-2 bg-mm-secondary text-mm-text border border-mm-border rounded hover:border-mm-cyan transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiDownload className="w-4 h-4" />}
            Загрузить с МП
          </button>
          <button
            onClick={pushToMarketplaces}
            disabled={pushing || selectedCount === 0 || changesCount === 0}
            className="px-4 py-2 bg-mm-cyan text-mm-dark font-medium rounded hover:bg-mm-cyan/90 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {pushing ? <FiRefreshCw className="w-4 h-4 animate-spin" /> : <FiUpload className="w-4 h-4" />}
            Отправить на МП
            {selectedCount > 0 && <span className="bg-mm-dark/20 px-1.5 py-0.5 rounded text-xs">{selectedCount}</span>}
          </button>
        </div>
      </div>

      {/* Marketplace Checkboxes */}
      <div className="bg-mm-secondary p-4 rounded-lg border border-mm-border">
        <div className="flex flex-wrap items-center gap-6">
          <span className="text-sm text-mm-text-secondary">Показать:</span>
          
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
          
          {/* Select all with changes */}
          {changesCount > 0 && (
            <button
              onClick={selectAllWithChanges}
              className="text-sm text-mm-cyan hover:underline"
            >
              Выбрать все с изменениями ({changesCount})
            </button>
          )}
          
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
                <th className="p-2 w-[30px]" rowSpan="2"></th>
                <th className="text-left p-2 font-medium text-mm-text-secondary uppercase text-xs w-[50px]" rowSpan="2">Фото</th>
                <th className="text-left p-2 font-medium text-mm-text-secondary uppercase text-xs min-w-[130px]" rowSpan="2">Товар</th>
                <th className="text-center p-2 font-medium text-green-400 uppercase text-xs w-[80px]" rowSpan="2">Закуп.</th>
                
                {/* Ozon columns */}
                {selectedMPs.ozon && (
                  <th className="text-center p-2 font-medium text-blue-400 uppercase text-xs border-l border-mm-border" colSpan="7">
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
                
                <th className="text-center p-2 font-medium text-mm-text-secondary uppercase text-xs border-l border-mm-border w-[80px]" rowSpan="2">Мин.<br/>цена</th>
                <th className="text-center p-2 font-medium text-mm-text-secondary uppercase text-xs w-[40px]" rowSpan="2"></th>
              </tr>
              
              {/* Sub-headers */}
              <tr className="border-b border-mm-border bg-mm-dark/70 text-[11px]">
                {selectedMPs.ozon && (
                  <>
                    <th className="p-1 text-center text-blue-300/70 font-normal border-l border-mm-border">Со скид.</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                    <th className="p-1 text-center text-blue-300/70 font-normal">До скид.</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                    <th className="p-1 text-center text-blue-300/70 font-normal">Мин.</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                    <th className="p-1 text-center text-orange-400/70 font-normal"><FiPercent className="inline w-3 h-3" /></th>
                  </>
                )}
                {selectedMPs.wb && (
                  <>
                    <th className="p-1 text-center text-purple-300/70 font-normal border-l border-mm-border">До скид.</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                    <th className="p-1 text-center text-purple-300/70 font-normal">Со скид.</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                    <th className="p-1 text-center text-purple-300/70 font-normal">Скидка</th>
                    <th className="p-1 text-center text-mm-cyan/70 font-normal bg-mm-cyan/5">Новая</th>
                  </>
                )}
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
                    } ${selectedProducts.has(product.product_id) ? 'bg-mm-cyan/5' : ''}`}
                  >
                    {/* Selection checkbox */}
                    <td className="p-2 text-center">
                      <button
                        onClick={() => toggleProductSelection(product.product_id)}
                        className="text-mm-text-secondary hover:text-mm-cyan"
                      >
                        {selectedProducts.has(product.product_id) ? (
                          <FiCheckSquare className="w-4 h-4 text-mm-cyan" />
                        ) : (
                          <FiSquare className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    
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
                      <div className="text-xs text-mm-text-secondary truncate max-w-[120px]">{product.name}</div>
                    </td>
                    
                    {/* Закупочная цена */}
                    <td className="p-1">
                      <EditablePrice
                        value={getNewValue(product, 'cost_price') || getCurrentValue(product, 'cost_price')}
                        onChange={(v) => updateLocalEdit(product.product_id, 'cost_price', v)}
                      />
                    </td>
                    
                    {/* Ozon prices */}
                    {selectedMPs.ozon && (
                      <>
                        <td className="p-1 border-l border-mm-border">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.price')} />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.price', v)}
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        
                        <td className="p-1">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.old_price')} />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.old_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.old_price', v)}
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        
                        <td className="p-1">
                          {product.ozon_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'ozon.min_price')} />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.ozon_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'ozon.min_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'ozon.min_price', v)}
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        
                        <td className="p-1">
                          {product.ozon_linked ? (
                            <CommissionBadge 
                              fbo={getCurrentValue(product, 'ozon.fbo_commission')} 
                              fbs={getCurrentValue(product, 'ozon.fbs_commission')} 
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                      </>
                    )}
                    
                    {/* WB prices */}
                    {selectedMPs.wb && (
                      <>
                        <td className="p-1 border-l border-mm-border">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.regular_price')} />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.regular_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.regular_price', v)}
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        
                        <td className="p-1">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.discount_price')} />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.discount_price')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.discount_price', v)}
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        
                        <td className="p-1">
                          {product.wb_linked ? (
                            <CurrentPrice value={getCurrentValue(product, 'wb.discount')} suffix="%" />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                        <td className="p-1 bg-mm-cyan/5">
                          {product.wb_linked ? (
                            <EditablePrice
                              value={getNewValue(product, 'wb.discount')}
                              onChange={(v) => updateLocalEdit(product.product_id, 'wb.discount', v)}
                              suffix="%"
                            />
                          ) : (
                            <span className="text-mm-text-secondary/30 text-xs block text-center">—</span>
                          )}
                        </td>
                      </>
                    )}
                    
                    {/* Min price */}
                    <td className="p-1 border-l border-mm-border">
                      <EditablePrice
                        value={getNewValue(product, 'min_allowed_price') || getCurrentValue(product, 'min_allowed_price')}
                        onChange={(v) => updateLocalEdit(product.product_id, 'min_allowed_price', v)}
                      />
                    </td>
                    
                    {/* Save button */}
                    <td className="p-1 text-center">
                      {hasChanges(product.product_id) && (
                        <button
                          onClick={() => saveProduct(product)}
                          disabled={savingProduct === product.product_id}
                          className="px-2 py-1 bg-mm-cyan text-mm-dark text-xs font-medium rounded hover:bg-mm-cyan/90 transition-colors disabled:opacity-50"
                          title="Сохранить в базу"
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
      <div className="flex flex-wrap gap-4 text-xs text-mm-text-secondary">
        <div className="flex items-center gap-2">
          <div className="w-14 h-5 bg-mm-secondary rounded border border-mm-border"></div>
          <span>Текущая цена</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-14 h-5 bg-mm-dark rounded border border-dashed border-mm-border"></div>
          <span>Поле для ввода</span>
        </div>
        <div className="flex items-center gap-2">
          <FiPercent className="w-4 h-4 text-orange-400" />
          <span>Комиссия</span>
        </div>
        <div className="flex items-center gap-2">
          <FiSave className="w-4 h-4 text-mm-cyan" />
          <span>Сохранить в базу</span>
        </div>
        <div className="flex items-center gap-2">
          <FiUpload className="w-4 h-4 text-mm-cyan" />
          <span>Отправить на МП</span>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
