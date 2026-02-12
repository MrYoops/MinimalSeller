import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const WarehousesListPage = () => {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWarehouseName, setNewWarehouseName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadWarehouses();
  }, []);

  const loadWarehouses = async () => {
    try {
      const response = await api.get('/api/warehouses');
      setWarehouses(response.data);
    } catch (error) {
      console.error('Error loading warehouses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newWarehouseName.trim()) {
      alert('Введите название склада');
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/api/warehouses', {
        name: newWarehouseName,
        type: warehouses.length === 0 ? 'main' : 'marketplace'
      });
      
      setShowCreateModal(false);
      setNewWarehouseName('');
      await loadWarehouses();
      
      // Navigate to the new warehouse detail page
      navigate(`/warehouses/${response.data.id}`);
    } catch (error) {
      console.error('Error creating warehouse:', error);
      alert(error.response?.data?.detail || 'Ошибка при создании склада');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Вы уверены, что хотите удалить склад "${name}"?`)) return;

    try {
      await api.delete(`/api/warehouses/${id}`);
      await loadWarehouses();
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      alert(error.response?.data?.detail || 'Ошибка при удалении склада');
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-mm-cyan">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex space-x-4">
          <button className="px-4 py-2 text-mm-cyan border-b-2 border-mm-cyan font-medium">
            Склады
          </button>
          <button className="px-4 py-2 text-gray-400 hover:text-mm-cyan transition">
            Аналитика
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-mm-purple hover:bg-purple-600 rounded-lg transition font-medium"
        >
          ДОБАВИТЬ СКЛАД
        </button>
      </div>

      {/* Table Controls */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex space-x-3">
          <button className="px-4 py-2 text-sm text-gray-400 hover:text-mm-cyan transition">
            СБРОСИТЬ ФИЛЬТРЫ
          </button>
          <button className="px-4 py-2 text-sm text-gray-400 hover:text-mm-cyan transition">
            ВЕРНУТЬ ПОРЯДОК СТОЛБЦОВ
          </button>
          <button className="px-4 py-2 text-sm text-gray-400 hover:text-mm-cyan transition">
            СТОЛБЦЫ
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Высота строки</span>
          <input
            type="range"
            min="30"
            max="100"
            defaultValue="50"
            className="w-24"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Название</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Статус</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Связи с МП</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Приоритет</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {warehouses.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                  <div className="space-y-2">
                    <p className="text-lg">📦 Нет складов</p>
                    <p className="text-sm">Создайте первый склад для начала работы</p>
                  </div>
                </td>
              </tr>
            ) : (
              warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-gray-800 transition cursor-pointer">
                  <td 
                    className="px-4 py-4"
                    onClick={() => navigate(`/warehouses/${warehouse.id}`)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">
                        {warehouse.type === 'main' ? '🏠' : warehouse.is_fbo ? '📦' : '🏢'}
                      </div>
                      <div>
                        <div className="text-mm-cyan hover:text-cyan-400 transition font-medium">
                          {warehouse.name}
                        </div>
                        {warehouse.address && (
                          <div className="text-xs text-gray-500 mt-1">{warehouse.address}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      warehouse.type === 'main' 
                        ? 'bg-purple-900 text-purple-200' 
                        : warehouse.is_fbo 
                        ? 'bg-blue-900 text-blue-200' 
                        : 'bg-green-900 text-green-200'
                    }`}>
                      {warehouse.type === 'main' ? 'Основной' : warehouse.is_fbo ? 'FBO' : 'FBS'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      {warehouse.load_orders && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-mm-cyan/20 text-mm-cyan">
                          📥 Заказы
                        </span>
                      )}
                      {warehouse.use_for_orders && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-green-900/30 text-green-400">
                          ✓ Отгрузка
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {warehouse.marketplace_links && warehouse.marketplace_links.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {warehouse.marketplace_links.slice(0, 3).map((link, idx) => (
                          <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                            {link.marketplace_name === 'ozon' && '🟠'}
                            {link.marketplace_name === 'wb' && '🟣'}
                            {link.marketplace_name === 'yandex' && '🔴'}
                            {link.marketplace_name?.toUpperCase()}
                          </span>
                        ))}
                        {warehouse.marketplace_links.length > 3 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
                            +{warehouse.marketplace_links.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500 text-sm">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-300">
                    {warehouse.priority || 0}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/warehouses/${warehouse.id}`);
                        }}
                        className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded transition"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(warehouse.id, warehouse.name);
                        }}
                        disabled={warehouse.type === 'main'}
                        className="p-2 text-red-500 hover:bg-red-500/10 disabled:text-gray-600 disabled:cursor-not-allowed rounded transition"
                        title={warehouse.type === 'main' ? 'Основной склад нельзя удалить' : 'Удалить'}
                      >
                        {warehouse.type === 'main' ? '🔒' : '🗑️'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
        <div className="flex items-center space-x-2">
          <span>Строк на странице</span>
          <select className="bg-gray-800 border border-gray-700 rounded px-2 py-1">
            <option>50</option>
            <option>100</option>
            <option>200</option>
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <span>{warehouses.length > 0 ? '1' : '0'} - {warehouses.length} из {warehouses.length}. Страница 1 из 1</span>
          <div className="flex space-x-1">
            <button className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition" disabled>«</button>
            <button className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition" disabled>‹</button>
            <button className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition" disabled>›</button>
            <button className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition" disabled>»</button>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-mm-cyan mb-4">Создать склад</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Название склада<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWarehouseName}
                onChange={(e) => setNewWarehouseName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-mm-cyan"
                placeholder="Введите название"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewWarehouseName('');
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-mm-purple hover:bg-purple-600 disabled:bg-gray-700 rounded-lg transition"
              >
                {creating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehousesListPage;
