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
  
  // Marketplace connections state
  const [integrations, setIntegrations] = useState([]);
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [mpWarehouses, setMpWarehouses] = useState([]);
  const [selectedMpWarehouse, setSelectedMpWarehouse] = useState('');
  const [loadingMpWarehouses, setLoadingMpWarehouses] = useState(false);
  const [warehouseLinks, setWarehouseLinks] = useState([]); // Multiple links
  
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
    fetchIntegrations();
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

  const fetchIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys');
      setIntegrations(response.data);
    } catch (error) {
      console.error('Error fetching integrations:', error);
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

  const loadMpWarehouses = async (integrationId) => {
    if (!integrationId) {
      setMpWarehouses([]);
      return;
    }

    setLoadingMpWarehouses(true);
    try {
      const response = await api.get(`/api/integrations/${integrationId}/warehouses`);
      setMpWarehouses(response.data.warehouses || []);
    } catch (error) {
      console.error('Error loading MP warehouses:', error);
      alert('Ошибка загрузки складов: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoadingMpWarehouses(false);
    }
  };

  const handleIntegrationChange = (integrationId) => {
    setSelectedIntegration(integrationId);
    setSelectedMpWarehouse('');
    loadMpWarehouses(integrationId);
  };

  const handleAddLink = async () => {
    if (!selectedIntegration || !selectedMpWarehouse) {
      alert('Выберите интеграцию и склад');
      return;
    }

    try {
      const integration = integrations.find(i => i.id === selectedIntegration);
      const mpWarehouse = mpWarehouses.find(w => w.id === selectedMpWarehouse);
      
      await api.post(`/api/warehouses/${id}/links`, {
        integration_id: selectedIntegration,
        marketplace_name: integration.marketplace,
        marketplace_warehouse_id: mpWarehouse.id,
        marketplace_warehouse_name: mpWarehouse.name
      });

      alert('✅ Связь добавлена!');
      fetchWarehouseLinks();
      setSelectedIntegration('');
      setSelectedMpWarehouse('');
      setMpWarehouses([]);
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
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_fbo}
                onChange={(e) => handleChange('is_fbo', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span>СКЛАД ДЛЯ УЧЕТА ОСТАТКОВ FBO</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.send_stock}
                onChange={(e) => handleChange('send_stock', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span>ПЕРЕДАВАТЬ ОСТАТКИ</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.load_orders}
                onChange={(e) => handleChange('load_orders', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span>ЗАГРУЖАТЬ ЗАКАЗЫ</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.use_for_orders}
                onChange={(e) => handleChange('use_for_orders', e.target.checked)}
                className="w-5 h-5 rounded"
              />
              <span>ИСПОЛЬЗОВАТЬ ДЛЯ ЗАКАЗОВ</span>
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
            
            {/* Add new link */}
            <div className="bg-gray-800 p-4 rounded-lg mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1">Выберите интеграцию</label>
                  <select
                    value={selectedIntegration}
                    onChange={(e) => handleIntegrationChange(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-mm-cyan text-sm"
                  >
                    <option value="">-- Выбрать --</option>
                    {integrations.map(integration => (
                      <option key={integration.id} value={integration.id}>
                        {integration.marketplace?.toUpperCase() || 'N/A'} - {integration.name || (integration.api_key ? integration.api_key.substring(0, 10) : 'No Key')}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-xs mb-1">
                    Выберите склад
                    {loadingMpWarehouses && <span className="ml-2 text-mm-cyan">загрузка...</span>}
                  </label>
                  <select
                    value={selectedMpWarehouse}
                    onChange={(e) => setSelectedMpWarehouse(e.target.value)}
                    disabled={!selectedIntegration || loadingMpWarehouses}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:outline-none focus:border-mm-cyan text-sm disabled:opacity-50"
                  >
                    <option value="">-- Выбрать --</option>
                    {mpWarehouses.map(wh => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} (ID: {wh.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <button
                onClick={handleAddLink}
                disabled={!selectedIntegration || !selectedMpWarehouse}
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
                    className="bg-gray-800 px-4 py-3 rounded space-y-2"
                  >
                    <div className="flex items-center justify-between">
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
                    
                    {/* Send Stock Toggle */}
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={link.send_stock !== false}
                        onChange={async (e) => {
                          try {
                            await api.put(`/api/warehouses/${id}/links/${link.id}`, {
                              send_stock: e.target.checked
                            });
                            fetchWarehouseLinks(); // Reload links
                          } catch (error) {
                            console.error('Error updating link:', error);
                            alert('Ошибка обновления: ' + (error.response?.data?.detail || error.message));
                          }
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-xs text-gray-300">Передавать остатки на эту интеграцию</span>
                    </label>
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
