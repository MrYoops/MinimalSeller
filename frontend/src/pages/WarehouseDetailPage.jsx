import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

const WarehouseDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [warehouse, setWarehouse] = useState({
    name: '',
    is_fbo_stock: false,
    do_not_transfer_stock: false,
    do_not_load_orders: false,
    use_for_orders: true,
    write_off_priority: 0,
    marketplace_connections: [],
    unplaced_cell: '',
    description: '',
    longitude: '',
    latitude: '',
    physical_address: '',
    brand: '',
    working_hours: '',
    assembly_hours: 0,
    storage_days: 0,
    online_prepayment: false,
    cash_payment: false,
    card_payment: false,
    goods_display: false
  });
  const [marketplaces, setMarketplaces] = useState([]);
  const [aisles, setAisles] = useState([]);
  const [showAdditionalSettings, setShowAdditionalSettings] = useState(false);
  const [showAddressStorage, setShowAddressStorage] = useState(false);

  useEffect(() => {
    if (id && id !== 'new') {
      fetchWarehouse();
    }
    fetchMarketplaces();
    fetchAisles();
  }, [id]);

  const fetchWarehouse = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/warehouses/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWarehouse(response.data);
    } catch (error) {
      console.error('Error fetching warehouse:', error);
    }
  };

  const fetchMarketplaces = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/marketplaces`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMarketplaces(response.data);
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    }
  };

  const fetchAisles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/warehouses/${id}/aisles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAisles(response.data);
    } catch (error) {
      console.error('Error fetching aisles:', error);
    }
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      if (id && id !== 'new') {
        await axios.put(`${API_URL}/api/warehouses/${id}`, warehouse, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Склад успешно обновлен');
      } else {
        await axios.post(`${API_URL}/api/warehouses`, warehouse, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Склад успешно создан');
      }
      navigate('/warehouses');
    } catch (error) {
      console.error('Error saving warehouse:', error);
      alert('Ошибка при сохранении склада');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">
            {id === 'new' ? 'Создать склад' : `Склад ${warehouse.name}`}
          </h1>
          <button
            onClick={() => navigate('/warehouses')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            НАЗАД
          </button>
        </div>

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          {/* Name */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              НАЗВАНИЕ *
            </label>
            <input
              type="text"
              value={warehouse.name}
              onChange={(e) => setWarehouse({ ...warehouse, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Введите название склада"
            />
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={warehouse.is_fbo_stock}
                onChange={(e) => setWarehouse({ ...warehouse, is_fbo_stock: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-gray-700">СКЛАД ДЛЯ УЧЕТА ОСТАТКОВ FBO</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={warehouse.do_not_transfer_stock}
                onChange={(e) => setWarehouse({ ...warehouse, do_not_transfer_stock: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-gray-700">НЕ ПЕРЕДАВАТЬ ОСТАТКИ</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={warehouse.do_not_load_orders}
                onChange={(e) => setWarehouse({ ...warehouse, do_not_load_orders: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-gray-700">НЕ ЗАГРУЖАТЬ ЗАКАЗЫ</span>
            </label>

            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={warehouse.use_for_orders}
                onChange={(e) => setWarehouse({ ...warehouse, use_for_orders: e.target.checked })}
                className="w-5 h-5 text-blue-600 rounded"
              />
              <span className="text-gray-700 font-semibold">ИСПОЛЬЗОВАТЬ ДЛЯ ЗАКАЗОВ</span>
            </label>
          </div>

          {/* Write-off Priority */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ПРИОРИТЕТ СПИСАНИЯ ОСТАТКОВ
            </label>
            <input
              type="number"
              value={warehouse.write_off_priority}
              onChange={(e) => setWarehouse({ ...warehouse, write_off_priority: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Marketplace Connections */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              СВЯЗИ СО СКЛАДАМИ МАРКЕТПЛЕЙСОВ
            </label>
            <div className="flex gap-3">
              <select className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                <option>Выберите маркетплейс</option>
                {marketplaces.map(mp => (
                  <option key={mp.id} value={mp.id}>{mp.name}</option>
                ))}
              </select>
              <select className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">
                <option>Моя организация</option>
              </select>
              <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                ДОБАВИТЬ
              </button>
            </div>
          </div>

          {/* Unplaced Cell */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              ЯЧЕЙКА ДЛЯ НЕ РАЗМЕЩЕННЫХ ТОВАРОВ
            </label>
            <input
              type="text"
              value={warehouse.unplaced_cell}
              onChange={(e) => setWarehouse({ ...warehouse, unplaced_cell: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Выберите ячейку"
            />
          </div>

          {/* Additional Settings Collapsible */}
          <div className="border-t border-gray-200 pt-4 mb-6">
            <button
              onClick={() => setShowAdditionalSettings(!showAdditionalSettings)}
              className="flex items-center text-blue-600 font-semibold hover:text-blue-700"
            >
              <span className="mr-2">{showAdditionalSettings ? '▼' : '▶'}</span>
              Дополнительные настройки склада
            </button>
            
            {showAdditionalSettings && (
              <div className="mt-4 space-y-4 pl-6">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Описание</label>
                  <textarea
                    value={warehouse.description}
                    onChange={(e) => setWarehouse({ ...warehouse, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Долгота</label>
                    <input
                      type="text"
                      value={warehouse.longitude}
                      onChange={(e) => setWarehouse({ ...warehouse, longitude: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Широта</label>
                    <input
                      type="text"
                      value={warehouse.latitude}
                      onChange={(e) => setWarehouse({ ...warehouse, latitude: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Фактический адрес склада</label>
                  <input
                    type="text"
                    value={warehouse.physical_address}
                    onChange={(e) => setWarehouse({ ...warehouse, physical_address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Бренд, который указывается на витрине</label>
                  <input
                    type="text"
                    value={warehouse.brand}
                    onChange={(e) => setWarehouse({ ...warehouse, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">График работы</label>
                  <input
                    type="text"
                    value={warehouse.working_hours}
                    onChange={(e) => setWarehouse({ ...warehouse, working_hours: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Кол-во часов для комплектации заказа</label>
                    <input
                      type="number"
                      value={warehouse.assembly_hours}
                      onChange={(e) => setWarehouse({ ...warehouse, assembly_hours: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 mb-1">Кол-во дней хранения заказа</label>
                    <input
                      type="number"
                      value={warehouse.storage_days}
                      onChange={(e) => setWarehouse({ ...warehouse, storage_days: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={warehouse.online_prepayment}
                      onChange={(e) => setWarehouse({ ...warehouse, online_prepayment: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-700">Онлайн предоплата</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={warehouse.cash_payment}
                      onChange={(e) => setWarehouse({ ...warehouse, cash_payment: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-700">Оплата наличными</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={warehouse.card_payment}
                      onChange={(e) => setWarehouse({ ...warehouse, card_payment: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-700">Оплата картой</span>
                  </label>

                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={warehouse.goods_display}
                      onChange={(e) => setWarehouse({ ...warehouse, goods_display: e.target.checked })}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <span className="text-gray-700">Отображение ассортимента на платформе ГУДС</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Address Storage Collapsible */}
          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() => setShowAddressStorage(!showAddressStorage)}
              className="flex items-center text-blue-600 font-semibold hover:text-blue-700"
            >
              <span className="mr-2">{showAddressStorage ? '▼' : '▶'}</span>
              Адресное хранение
            </button>
            
            {showAddressStorage && (
              <div className="mt-4 pl-6">
                <p className="text-gray-600">Настройки адресного хранения будут здесь</p>
              </div>
            )}
          </div>
        </div>

        {/* Aisles List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Список проходов</h2>
          
          <div className="mb-4 flex justify-between items-center">
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                СБРОСИТЬ ФИЛЬТРЫ
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                ВЕРНУТЬ ПОРЯДОК СТОЛБЦОВ
              </button>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                СТОЛБЦЫ
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Высота строки</span>
              <input type="range" min="1" max="3" className="w-24" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Просмотреть список стеллажей</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Копировать</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Печать</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Удалить</th>
                </tr>
              </thead>
              <tbody>
                {aisles.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      Нет данных
                    </td>
                  </tr>
                ) : (
                  aisles.map(aisle => (
                    <tr key={aisle.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3">{aisle.name}</td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:underline">Просмотреть</button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:underline">Копировать</button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-blue-600 hover:underline">Печать</button>
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-red-600 hover:underline">Удалить</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-between items-center text-sm text-gray-600">
            <div>
              <select className="border border-gray-300 rounded px-2 py-1">
                <option>50</option>
                <option>100</option>
                <option>200</option>
              </select>
              <span className="ml-2">Строк на странице</span>
            </div>
            <div>
              0 - 0 из 0. Страница 0 из 0
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-start">
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md"
          >
            СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default WarehouseDetailPage;
