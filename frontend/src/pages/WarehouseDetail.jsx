import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const WarehouseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  
  const [warehouse, setWarehouse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [showAisles, setShowAisles] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    is_fbo: false,
    send_stock: true,
    load_orders: true,
    use_for_orders: true,
    priority: 0,
    default_cell: '',
    marketplace_name: '',
    marketplace_warehouse_id: '',
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
        marketplace_name: response.data.marketplace_name || '',
        marketplace_warehouse_id: response.data.marketplace_warehouse_id || '',
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

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/warehouses/${id}`, formData);
      alert('Склад успешно обновлен');
      navigate('/dashboard');
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
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      alert(error.response?.data?.detail || 'Ошибка при удалении склада');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <div className="text-mm-cyan text-xl">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mm-black text-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-mm-cyan">Склад {formData.name}</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
          >
            НАЗАД
          </button>
        </div>

        {/* Main Form */}
        <div className="bg-gray-900 rounded-lg p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              НАЗВАНИЕ<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_fbo}
                onChange={(e) => handleChange('is_fbo', e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
              />
              <span>СКЛАД ДЛЯ УЧЕТА ОСТАТКОВ FBO</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.send_stock}
                onChange={(e) => handleChange('send_stock', !e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
              />
              <span>НЕ ПЕРЕДАВАТЬ ОСТАТКИ</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!formData.load_orders}
                onChange={(e) => handleChange('load_orders', !e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
              />
              <span>НЕ ЗАГРУЖАТЬ ЗАКАЗЫ</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.use_for_orders}
                onChange={(e) => handleChange('use_for_orders', e.target.checked)}
                className="w-5 h-5 rounded border-gray-600 text-mm-purple focus:ring-mm-purple"
              />
              <span className="text-mm-purple font-medium">ИСПОЛЬЗОВАТЬ ДЛЯ ЗАКАЗОВ</span>
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

          {/* Marketplace Connection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              СВЯЗИ СО СКЛАДАМИ МАРКЕТПЛЕЙСОВ
            </label>
            <div className="flex space-x-3">
              <select
                value={formData.marketplace_name}
                onChange={(e) => handleChange('marketplace_name', e.target.value)}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
              >
                <option value="">Выберите маркетплейс</option>
                <option value="ozon">Ozon</option>
                <option value="wildberries">Wildberries</option>
                <option value="yandex">Яндекс.Маркет</option>
              </select>
              <select
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                disabled
              >
                <option value="">Выберите склад</option>
              </select>
              <button className="px-6 py-2 bg-mm-purple hover:bg-purple-600 rounded-lg transition">
                ДОБАВИТЬ
              </button>
            </div>
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
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.online_payment}
                      onChange={(e) => handleChange('online_payment', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
                    />
                    <span>Онлайн предоплата</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cash_payment}
                      onChange={(e) => handleChange('cash_payment', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
                    />
                    <span>Оплата наличными</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.card_payment}
                      onChange={(e) => handleChange('card_payment', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
                    />
                    <span>Оплата картой</span>
                  </label>

                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.show_on_goods}
                      onChange={(e) => handleChange('show_on_goods', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-600 text-mm-cyan focus:ring-mm-cyan"
                    />
                    <span>Отображение ассортимента на платформе ГУДС</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Aisles */}
          <div className="border-t border-gray-700 pt-4">
            <button
              onClick={() => setShowAisles(!showAisles)}
              className="flex items-center space-x-2 text-mm-cyan hover:text-cyan-400 transition"
            >
              <span className="text-xl">{showAisles ? '▼' : '▶'}</span>
              <span className="font-medium">Адресное хранение</span>
            </button>
            
            {showAisles && (
              <div className="mt-4 pl-6">
                <h3 className="text-lg font-medium mb-4">Список проходов</h3>
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="text-center text-gray-500 py-8">
                    Нет данных
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-between">
          <button
            onClick={handleDelete}
            disabled={warehouse?.type === 'main'}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg transition font-medium"
          >
            УДАЛИТЬ
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-mm-cyan hover:bg-cyan-600 disabled:bg-gray-700 rounded-lg transition font-medium"
          >
            {saving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseDetail;
