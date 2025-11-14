import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiTrash2, FiEdit, FiCheck, FiX } from 'react-icons/fi';

const IntegrationsPage = () => {
  const { api } = useAuth();
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMarketplace, setSelectedMarketplace] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    api_key: '',
    auto_sync_stock: true,
    auto_update_prices: false,
    auto_get_orders: true
  });
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const marketplaces = [
    {
      id: 'ozon',
      name: 'Ozon',
      logo: '🟠',
      description: 'Интеграция с Ozon для работы с товарами, заказами FBS и аналитикой',
      fields: [
        { name: 'name', label: 'Название интеграции', type: 'text', placeholder: 'Например: Основной магазин OZON' },
        { name: 'client_id', label: 'Client ID', type: 'text', placeholder: 'Введите Client ID' },
        { name: 'api_key', label: 'API Key', type: 'password', placeholder: 'Введите API ключ' }
      ]
    },
    {
      id: 'wb',
      name: 'Wildberries',
      logo: '🟣',
      description: 'Интеграция с Wildberries для работы с товарами, заказами FBS и аналитикой',
      fields: [
        { name: 'name', label: 'Название интеграции', type: 'text', placeholder: 'Например: Основной магазин WB' },
        { name: 'api_key', label: 'API Token', type: 'password', placeholder: 'Введите API токен' }
      ]
    },
    {
      id: 'yandex',
      name: 'Yandex.Market',
      logo: '🔴',
      description: 'Интеграция с Яндекс.Маркет для работы с товарами, заказами FBS и аналитикой',
      fields: [
        { name: 'name', label: 'Название интеграции', type: 'text', placeholder: 'Например: Основной магазин Яндекс' },
        { name: 'client_id', label: 'Campaign ID', type: 'text', placeholder: 'Введите Campaign ID' },
        { name: 'api_key', label: 'OAuth Token', type: 'password', placeholder: 'Введите OAuth токен' }
      ]
    }
  ];

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const response = await api.get('/api/seller/api-keys');
      setApiKeys(response.data);
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (marketplaceId) => {
    setSelectedMarketplace(marketplaceId);
    setFormData({
      name: '',
      client_id: '',
      api_key: '',
      auto_sync_stock: true,
      auto_update_prices: false,
      auto_get_orders: true
    });
    setShowAddModal(true);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await api.post('/api/seller/api-keys/test', {
        marketplace: selectedMarketplace,
        client_id: formData.client_id,
        api_key: formData.api_key
      });

      if (response.data.success) {
        alert(response.data.message);
      } else {
        alert(response.data.message);
      }
    } catch (error) {
      alert('Ошибка тестирования: ' + (error.response?.data?.detail || error.message));
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.api_key || !formData.api_key.trim()) {
      alert('API ключ обязателен');
      return;
    }

    setSaving(true);
    try {
      await api.post('/api/seller/api-keys', {
        marketplace: selectedMarketplace,
        name: formData.name,
        client_id: formData.client_id,
        api_key: formData.api_key
      });

      alert('✅ Интеграция успешно добавлена!');
      setShowAddModal(false);
      loadApiKeys();
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (keyId, marketplace) => {
    if (!confirm(`Удалить интеграцию ${marketplace.toUpperCase()}?`)) return;

    try {
      await api.delete(`/api/seller/api-keys/${keyId}`);
      alert('✅ Интеграция удалена');
      loadApiKeys();
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleSetting = async (keyId, field, currentValue) => {
    try {
      await api.put(`/api/seller/api-keys/${keyId}`, {
        [field]: !currentValue
      });
      loadApiKeys();
    } catch (error) {
      alert('Ошибка обновления: ' + (error.response?.data?.detail || error.message));
    }
  };

  const getMarketplaceLogo = (marketplace) => {
    const mp = marketplaces.find(m => m.id === marketplace);
    return mp ? mp.logo : '📦';
  };

  const getMarketplaceName = (marketplace) => {
    const mp = marketplaces.find(m => m.id === marketplace);
    return mp ? mp.name : marketplace;
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-mm-cyan">Загрузка...</div>
      </div>
    );
  }

  const selectedMp = marketplaces.find(m => m.id === selectedMarketplace);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-mm-cyan mb-2">ИНТЕГРАЦИИ</h1>
        <p className="text-gray-400">Подключите маркетплейсы для автоматизации работы</p>
      </div>

      {/* Active Integrations */}
      {apiKeys.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Активные интеграции</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiKeys.map((key) => (
              <div key={key.id} className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-mm-cyan transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-4xl">{getMarketplaceLogo(key.marketplace)}</div>
                    <div>
                      <h3 className="font-bold text-white">{key.name || getMarketplaceName(key.marketplace)}</h3>
                      <p className="text-xs text-gray-500">{getMarketplaceName(key.marketplace)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id, key.marketplace)}
                    className="p-2 text-red-500 hover:bg-red-500/10 rounded transition"
                    title="Удалить"
                  >
                    <FiTrash2 />
                  </button>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Client ID:</span>
                    <span className="text-gray-300">{key.client_id || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">API Key:</span>
                    <span className="text-gray-300">{key.api_key_masked}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Добавлено:</span>
                    <span className="text-gray-300">{new Date(key.created_at).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>

                {/* Settings */}
                <div className="mt-4 pt-4 border-t border-gray-800 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-gray-400 group-hover:text-gray-300">Синхронизация остатков</span>
                    <input
                      type="checkbox"
                      checked={key.auto_sync_stock !== false}
                      onChange={() => handleToggleSetting(key.id, 'auto_sync_stock', key.auto_sync_stock !== false)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-gray-400 group-hover:text-gray-300">Обновление цен</span>
                    <input
                      type="checkbox"
                      checked={key.auto_update_prices === true}
                      onChange={() => handleToggleSetting(key.id, 'auto_update_prices', key.auto_update_prices === true)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer group">
                    <span className="text-xs text-gray-400 group-hover:text-gray-300">Загрузка заказов</span>
                    <input
                      type="checkbox"
                      checked={key.auto_get_orders !== false}
                      onChange={() => handleToggleSetting(key.id, 'auto_get_orders', key.auto_get_orders !== false)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Marketplaces */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Доступные маркетплейсы</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {marketplaces.map((marketplace) => {
            const hasIntegration = apiKeys.some(k => k.marketplace === marketplace.id);
            
            return (
              <div
                key={marketplace.id}
                className="bg-gray-900 rounded-lg p-6 border border-gray-800 hover:border-mm-cyan transition"
              >
                <div className="text-center mb-4">
                  <div className="text-6xl mb-3">{marketplace.logo}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{marketplace.name}</h3>
                  <p className="text-sm text-gray-400">{marketplace.description}</p>
                </div>

                <button
                  onClick={() => handleOpenModal(marketplace.id)}
                  className="w-full px-4 py-3 bg-mm-purple hover:bg-purple-600 rounded-lg transition font-medium flex items-center justify-center space-x-2"
                >
                  <FiPlus />
                  <span>{hasIntegration ? 'ДОБАВИТЬ ЕЩЕ' : 'НАСТРОИТЬ'}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Integration Modal */}
      {showAddModal && selectedMp && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="text-3xl">{selectedMp.logo}</div>
                  <div>
                    <h2 className="text-2xl font-bold text-mm-cyan">{selectedMp.name}</h2>
                    <p className="text-sm text-gray-400">{selectedMp.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <FiX size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {selectedMp.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium mb-2 text-gray-300">
                    {field.label}
                    {field.name !== 'name' && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={field.type}
                    value={formData[field.name]}
                    onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan text-white"
                  />
                </div>
              ))}

              {/* Auto settings */}
              <div className="pt-4 border-t border-gray-800">
                <p className="text-sm font-medium mb-3 text-gray-300">Автоматические настройки:</p>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_sync_stock}
                      onChange={(e) => setFormData({ ...formData, auto_sync_stock: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm text-gray-400">Автоматическая синхронизация остатков</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_update_prices}
                      onChange={(e) => setFormData({ ...formData, auto_update_prices: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm text-gray-400">Автоматическое обновление цен</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.auto_get_orders}
                      onChange={(e) => setFormData({ ...formData, auto_get_orders: e.target.checked })}
                      className="w-5 h-5 rounded"
                    />
                    <span className="text-sm text-gray-400">Автоматическая загрузка заказов</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-800 flex justify-end space-x-3">
              <button
                onClick={handleTest}
                disabled={testing || !formData.api_key}
                className="px-6 py-3 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed rounded-lg transition font-medium"
              >
                {testing ? 'Тестирование...' : 'ТЕСТ ПОДКЛЮЧЕНИЯ'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.api_key}
                className="px-6 py-3 bg-mm-cyan hover:bg-cyan-400 text-black disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed rounded-lg transition font-bold"
              >
                {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsPage;
