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
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">ID</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Название</th>
              <th className="px-6 py-3 text-left text-sm font-medium text-gray-300">Удалить</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {warehouses.length === 0 ? (
              <tr>
                <td colSpan="3" className="px-6 py-8 text-center text-gray-500">
                  Нет данных
                </td>
              </tr>
            ) : (
              warehouses.map((warehouse) => (
                <tr key={warehouse.id} className="hover:bg-gray-800 transition">
                  <td className="px-6 py-4 text-sm text-gray-300">{warehouse.id.slice(-5)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/warehouses/${warehouse.id}`)}
                      className="text-mm-cyan hover:text-cyan-400 transition font-medium"
                    >
                      {warehouse.name}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleDelete(warehouse.id, warehouse.name)}
                      disabled={warehouse.type === 'main'}
                      className="text-red-500 hover:text-red-400 disabled:text-gray-600 disabled:cursor-not-allowed transition"
                    >
                      {warehouse.type === 'main' ? '🔒' : '🗑️'}
                    </button>
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
