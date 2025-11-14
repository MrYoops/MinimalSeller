import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiTrash2, FiPlus, FiRefreshCw } from 'react-icons/fi';

const WarehouseDetailNew = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [showAisles, setShowAisles] = useState(false);
  
  // Marketplace connections state - SIMPLIFIED 2-STEP (like SelSup)
  const [selectedMarketplace, setSelectedMarketplace] = useState(''); // Step 1: Marketplace
  const [mpWarehouses, setMpWarehouses] = useState([]); // Step 2: Warehouses from ALL integrations
  const [selectedMpWarehouse, setSelectedMpWarehouse] = useState(''); // Step 2: Selected warehouse
  const [loadingMpWarehouses, setLoadingMpWarehouses] = useState(false);
  const [warehouseLinks, setWarehouseLinks] = useState([]); // Multiple links
  
  // For Yandex manual ID input
  const [manualWarehouseId, setManualWarehouseId] = useState('');
  const [manualWarehouseName, setManualWarehouseName] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    is_fbo: false,
    send_stock: true,
    load_orders: true,
    use_for_orders: true,
    priority: 0,
    default_cell: '',
    description: '',
    longitude: null,
    latitude: null,
    address: '',
    brand: '',
    working_hours: '',
    assembly_hours: 0,
    storage_days: 0,
    online_payment: false,
    cash_payment: false,
    card_payment: false,
    show_on_goods: false
  });

  useEffect(() => {
    fetchWarehouse();
    fetchWarehouseLinks();
  }, [id]);

  const fetchWarehouse = async () => {
    try {
      const response = await api.get(`/api/warehouses/${id}`);
      setWarehouse(response.data);
      setFormData({
        name: response.data.name || '',
        is_fbo: response.data.is_fbo || false,
        send_stock: response.data.send_stock !== false,
        load_orders: response.data.load_orders !== false,
        use_for_orders: response.data.use_for_orders !== false,
        priority: response.data.priority || 0,
        default_cell: response.data.default_cell || '',
        description: response.data.description || '',
        longitude: response.data.longitude,
        latitude: response.data.latitude,
        address: response.data.address || '',
        brand: response.data.brand || '',
        working_hours: response.data.working_hours || '',
        assembly_hours: response.data.assembly_hours || 0,
        storage_days: response.data.storage_days || 0,
        online_payment: response.data.online_payment || false,
        cash_payment: response.data.cash_payment || false,
        card_payment: response.data.card_payment || false,
        show_on_goods: response.data.show_on_goods || false
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching warehouse:', error);
      setLoading(false);
    }
  };

  const fetchWarehouseLinks = async () => {
    try {
      const response = await api.get(`/api/warehouses/${id}/links`);
      setWarehouseLinks(response.data || []);
    } catch (error) {
      console.error('Error fetching warehouse links:', error);
    }
  };

  const loadMpWarehouses = async (marketplace) => {
    if (!marketplace) {
      setMpWarehouses([]);
      return;
    }

    setLoadingMpWarehouses(true);
    try {
      // NEW API - Load ALL warehouses from ALL integrations of this marketplace
      const response = await api.get(`/api/marketplaces/${marketplace}/all-warehouses`);
      setMpWarehouses(response.data.warehouses || []);
      
      if (response.data.warehouses.length === 0 && response.data.message) {
        alert(response.data.message);
      }
    } catch (error) {
      console.error('Error loading MP warehouses:', error);
      alert('Ошибка загрузки складов: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingMpWarehouses(false);
    }
  };

  // When marketplace is selected - load ALL warehouses immediately
  const handleMarketplaceChange = (marketplace) => {
    setSelectedMarketplace(marketplace);
    setSelectedMpWarehouse('');
    setMpWarehouses([]);
    setManualWarehouseId('');
    setManualWarehouseName('');
    
    // For Yandex, we need manual ID input (API doesn't provide warehouse list)
    if (marketplace && marketplace !== 'yandex') {
      loadMpWarehouses(marketplace);
    }
  };

  const handleAddLink = async () => {
    // Validation
    if (!selectedMarketplace) {
      alert('Выберите маркетплейс');
      return;
    }
    
    // For Yandex - manual ID input required
    if (selectedMarketplace === 'yandex') {
      if (!manualWarehouseId || !manualWarehouseName) {
        alert('Введите ID склада и название для Яндекс.Маркет');
        return;
      }
    } else {
      // For Ozon/WB - select from dropdown
      if (!selectedMpWarehouse) {
        alert('Выберите склад из списка');
        return;
      }
    }

    try {
      let linkData;
      
      if (selectedMarketplace === 'yandex') {
        // Yandex - use manual input
        // For Yandex, we need to find any integration of this marketplace
        const integrations = await api.get('/api/seller/api-keys');
        const yandexIntegration = integrations.data.find(i => i.marketplace === 'yandex');
        
        if (!yandexIntegration) {
          alert('Сначала добавьте интеграцию Яндекс.Маркет в разделе ИНТЕГРАЦИИ');
          return;
        }
        
        linkData = {
          integration_id: yandexIntegration.id,
          marketplace_name: 'yandex',
          marketplace_warehouse_id: manualWarehouseId,
          marketplace_warehouse_name: manualWarehouseName
        };
      } else {
        // Ozon/WB - use selected warehouse from dropdown
        const mpWarehouse = mpWarehouses.find(w => w.id === selectedMpWarehouse);
        linkData = {
          integration_id: mpWarehouse.integration_id,
          marketplace_name: selectedMarketplace,
          marketplace_warehouse_id: mpWarehouse.id,
          marketplace_warehouse_name: mpWarehouse.name
        };
      }
      
      await api.post(`/api/warehouses/${id}/links`, linkData);

      // First reload links, THEN show alert
      await fetchWarehouseLinks();
      
      // Reset form
      setSelectedMarketplace('');
      setSelectedMpWarehouse('');
      setMpWarehouses([]);
      setManualWarehouseId('');
      setManualWarehouseName('');
      
      // Show success alert AFTER UI update
      alert(`✅ Связь со складом ${selectedMarketplace.toUpperCase()} добавлена!`);
    } catch (error) {
      console.error('Error adding link:', error);
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteLink = async (linkId) => {
    if (!confirm('Удалить связь?')) return;

    try {
      await api.delete(`/api/warehouses/${id}/links/${linkId}`);
      alert('✅ Связь удалена');
      fetchWarehouseLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/warehouses/${id}`, formData);
      alert('Склад успешно обновлен');
      navigate(-1);
    } catch (error) {
      console.error('Error saving warehouse:', error);
      alert('Ошибка при сохранении склада');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Вы уверены, что хотите удалить этот склад?')) return;
    
    try {
      await api.delete(`/api/warehouses/${id}`);
      alert('Склад удален');
      navigate(-1);
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      alert('Ошибка при удалении склада');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mm-black text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-mm-cyan hover:text-cyan-400 mb-4"
          >
            ← Назад
          </button>
          <h1 className="text-3xl font-bold text-mm-cyan">Настройки склада</h1>
        </div>

        {/* Form */}
        <div className="bg-gray-900 rounded-lg p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">НАЗВАНИЕ</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
            />
          </div>

          {/* Basic Settings */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded transition">
              <input
                type="checkbox"
                checked={formData.is_fbo}
                onChange={(e) => handleChange('is_fbo', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">СКЛАД ДЛЯ УЧЕТА ОСТАТКОВ FBO</span>
                <p className="text-xs text-gray-400 mt-1">Для аналитики FIFO по заказам FBO</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded transition">
              <input
                type="checkbox"
                checked={formData.send_stock}
                onChange={(e) => handleChange('send_stock', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">ПЕРЕДАВАТЬ ОСТАТКИ</span>
                <p className="text-xs text-gray-400 mt-1">SelSup будет автоматически обновлять остатки на маркетплейсах. Отключите для фулфилмента.</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded transition">
              <input
                type="checkbox"
                checked={formData.load_orders}
                onChange={(e) => handleChange('load_orders', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">ЗАГРУЖАТЬ ЗАКАЗЫ</span>
                <p className="text-xs text-gray-400 mt-1">Импортировать заказы с этого склада. Отключите для фулфилмента.</p>
              </div>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer hover:bg-gray-800 p-2 rounded transition">
              <input
                type="checkbox"
                checked={formData.use_for_orders}
                onChange={(e) => handleChange('use_for_orders', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <div>
                <span className="font-medium">ИСПОЛЬЗОВАТЬ ДЛЯ ЗАКАЗОВ</span>
                <p className="text-xs text-gray-400 mt-1">Склад будет проставляться в заказах. Иначе только для остатков.</p>
              </div>
            </label>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ПРИОРИТЕТ СПИСАНИЯ ОСТАТКОВ
            </label>
            <input
              type="number"
              value={formData.priority}
              onChange={(e) => handleChange('priority', parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
            />
          </div>

          {/* Marketplace Connections - ENHANCED */}
          <div>
            <label className="block text-sm font-medium mb-3 text-mm-cyan">
              СВЯЗИ СО СКЛАДАМИ МАРКЕТПЛЕЙСОВ
            </label>
            
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-4">
              <p className="text-xs text-blue-300">
                💡 <strong>Важно:</strong> Связь позволяет SelSup знать, какой склад МП соответствует этому складу в системе.
                Настройка "Передавать остатки" управляется выше на уровне склада, а не для каждой связи отдельно.
              </p>
            </div>
            
            {/* Add new link - SIMPLIFIED 2-STEP (like SelSup) */}
            <div className="bg-gray-800 p-4 rounded-lg mb-4 space-y-3">
              <p className="text-xs text-mm-cyan mb-3">
                🔗 Автоматическая загрузка FBS складов со ВСЕХ интеграций маркетплейса
              </p>
              
              {/* Step 1: Select Marketplace */}
              <div>
                <label className="block text-xs mb-1 font-mono">1️⃣ ВЫБЕРИТЕ МАРКЕТПЛЕЙС</label>
                <select
                  value={selectedMarketplace}
                  onChange={(e) => handleMarketplaceChange(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-mm-cyan text-sm"
                >
                  <option value="">-- Выбрать маркетплейс --</option>
                  <option value="ozon">OZON</option>
                  <option value="wb">WILDBERRIES</option>
                  <option value="yandex">YANDEX.MARKET</option>
                </select>
              </div>
              
              {/* Step 2: Select Warehouse (Auto-loaded from ALL integrations) */}
              {selectedMarketplace && (
                <div>
                  <label className="block text-xs mb-1 font-mono">
                    2️⃣ ВЫБЕРИТЕ СКЛАД FBS
                    {loadingMpWarehouses && <span className="ml-2 text-mm-cyan animate-pulse">загрузка...</span>}
                  </label>
                  <select
                    value={selectedMpWarehouse}
                    onChange={(e) => setSelectedMpWarehouse(e.target.value)}
                    disabled={loadingMpWarehouses}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-mm-cyan text-sm disabled:opacity-50"
                  >
                    <option value="">-- Выбрать склад --</option>
                    {mpWarehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} (ID: {wh.id}) {wh.integration_name ? `[${wh.integration_name}]` : ''}
                      </option>
                    ))}
                  </select>
                  {mpWarehouses.length === 0 && !loadingMpWarehouses && (
                    <p className="text-xs text-yellow-400 mt-1">
                      ⚠️ Склады не найдены. Убедитесь что:
                      <br/>• Добавлена хотя бы одна интеграция {selectedMarketplace.toUpperCase()} в разделе ИНТЕГРАЦИИ
                      <br/>• Создан FBS склад в личном кабинете {selectedMarketplace.toUpperCase()}
                    </p>
                  )}
                </div>
              )}
              
              <button
                onClick={handleAddLink}
                disabled={!selectedMarketplace || !selectedMpWarehouse}
                className="w-full px-4 py-2 bg-mm-purple hover:bg-purple-600 rounded transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <FiPlus />
                <span>ДОБАВИТЬ СВЯЗЬ</span>
              </button>
            </div>

            {/* Existing links */}
            {warehouseLinks.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 mb-2">Активные связи:</p>
                {warehouseLinks.map((link, index) => (
                  <div
                    key={index}
                    className="bg-gray-800 px-4 py-3 rounded flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {link.marketplace_name?.toUpperCase()} - {link.marketplace_warehouse_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        ID: {link.marketplace_warehouse_id}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteLink(link.id)}
                      className="px-3 py-2 text-red-400 hover:bg-red-400/10 rounded transition"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Default Cell */}
          <div>
            <label className="block text-sm font-medium mb-2">
              ЯЧЕЙКА ДЛЯ НЕ РАЗМЕЩЕННЫХ ТОВАРОВ
            </label>
            <input
              type="text"
              value={formData.default_cell}
              onChange={(e) => handleChange('default_cell', e.target.value)}
              placeholder="Выберите ячейку"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
            />
          </div>

          {/* Additional Settings */}
          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={() => setShowAdditional(!showAdditional)}
              className="flex items-center space-x-2 text-mm-cyan hover:text-cyan-400 transition"
            >
              <span className="text-xl">{showAdditional ? '▼' : '▶'}</span>
              <span className="font-medium">Дополнительные настройки склада</span>
            </button>
            
            {showAdditional && (
              <div className="mt-4 space-y-4 pl-6">
                <div>
                  <label className="block text-sm mb-2">Описание</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2">Долгота</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude || ''}
                      onChange={(e) => handleChange('longitude', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Широта</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude || ''}
                      onChange={(e) => handleChange('latitude', parseFloat(e.target.value) || null)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-2">Фактический адрес склада</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">Бренд, который указывается на витрине</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => handleChange('brand', e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2">График работы</label>
                  <input
                    type="text"
                    value={formData.working_hours}
                    onChange={(e) => handleChange('working_hours', e.target.value)}
                    placeholder="Например: Пн-Пт 9:00-18:00"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2">Кол-во часов для комплектации заказа</label>
                    <input
                      type="number"
                      value={formData.assembly_hours}
                      onChange={(e) => handleChange('assembly_hours', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2">Кол-во дней хранения заказа</label>
                    <input
                      type="number"
                      value={formData.storage_days}
                      onChange={(e) => handleChange('storage_days', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium mb-2">Способы оплаты:</p>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.online_payment}
                      onChange={(e) => handleChange('online_payment', e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <span>Онлайн предоплата</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cash_payment}
                      onChange={(e) => handleChange('cash_payment', e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <span>Наличными при получении</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.card_payment}
                      onChange={(e) => handleChange('card_payment', e.target.checked)}
                      className="w-5 h-5 rounded"
                    />
                    <span>Картой при получении</span>
                  </label>
                </div>

                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_on_goods}
                    onChange={(e) => handleChange('show_on_goods', e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span>Отображать на площадке Goods</span>
                </label>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t border-gray-700">
            <button
              onClick={handleDelete}
              disabled={warehouse?.type === 'main'}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              УДАЛИТЬ
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-2 bg-mm-cyan hover:bg-cyan-400 text-black font-bold rounded-lg transition disabled:opacity-50"
            >
              {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarehouseDetailNew;
