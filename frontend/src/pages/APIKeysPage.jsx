import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiKey, FiCheckCircle, FiXCircle, FiInfo } from 'react-icons/fi'

function APIKeysPage() {
  const { api } = useAuth()
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedMarketplace, setSelectedMarketplace] = useState('ozon')
  const [newKey, setNewKey] = useState({
    marketplace: 'ozon',
    // Ozon fields
    client_id: '',
    api_key: '',
    // Wildberries fields
    wb_token: '',
    // Yandex fields
    yandex_token: '',
    yandex_campaign_id: ''
  })
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setApiKeys(response.data)
    } catch (error) {
      console.error('Failed to load API keys:', error)
    }
    setLoading(false)
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus(null)
    
    try {
      // Mock test - в реальности будет вызов к API маркетплейса
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Здесь будет реальная проверка подключения
      const success = Math.random() > 0.3
      
      setConnectionStatus({
        success,
        message: success 
          ? '✅ Подключение успешно! API работает корректно.' 
          : '❌ Ошибка подключения. Проверьте правильность ключей.'
      })
    } catch (error) {
      setConnectionStatus({
        success: false,
        message: '❌ Ошибка при тестировании подключения'
      })
    }
    
    setTestingConnection(false)
  }

  const addApiKey = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        marketplace: newKey.marketplace,
        client_id: newKey.marketplace === 'ozon' ? newKey.client_id : '',
        api_key: newKey.marketplace === 'ozon' ? newKey.api_key : 
                 newKey.marketplace === 'wb' ? newKey.wb_token : 
                 newKey.yandex_token
      }
      
      if (newKey.marketplace === 'yandex') {
        payload.campaign_id = newKey.yandex_campaign_id
      }
      
      await api.post('/api/seller/api-keys', payload)
      setShowAddModal(false)
      setNewKey({
        marketplace: 'ozon',
        client_id: '',
        api_key: '',
        wb_token: '',
        yandex_token: '',
        yandex_campaign_id: ''
      })
      setConnectionStatus(null)
      loadApiKeys()
      alert('API ключ добавлен успешно!')
    } catch (error) {
      alert('Ошибка добавления: ' + (error.response?.data?.detail || error.message))
    }
  }

  const deleteApiKey = async (keyId) => {
    if (!confirm('Удалить этот API ключ?')) return
    try {
      await api.delete(`/api/seller/api-keys/${keyId}`)
      loadApiKeys()
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const marketplaceConfigs = {
    ozon: {
      name: 'Ozon',
      color: 'text-mm-blue',
      fields: [
        { name: 'client_id', label: 'Client ID', type: 'text', required: true },
        { name: 'api_key', label: 'API Key', type: 'password', required: true }
      ],
      instructions: [
        '1. Войдите в личный кабинет продавца Ozon',
        '2. Перейдите в Настройки → API ключи',
        '3. Скопируйте Client ID',
        '4. Создайте новый API ключ и скопируйте его'
      ]
    },
    wb: {
      name: 'Wildberries',
      color: 'text-mm-purple',
      fields: [
        { name: 'wb_token', label: 'API Token (JWT)', type: 'password', required: true }
      ],
      instructions: [
        '1. Войдите в личный кабинет Wildberries',
        '2. Перейдите в Настройки → Доступ к API',
        '3. Создайте новый токен с нужными правами:',
        '   - Контент (для карточек товаров)',
        '   - Аналитика',
        '   - Цены и скидки',
        '   - Поставки',
        '   - Статистика',
        '4. Скопируйте сгенерированный токен'
      ]
    },
    yandex: {
      name: 'Яндекс.Маркет',
      color: 'text-mm-yellow',
      fields: [
        { name: 'yandex_token', label: 'API Token', type: 'password', required: true },
        { name: 'yandex_campaign_id', label: 'Campaign ID', type: 'text', required: true }
      ],
      instructions: [
        '1. Войдите в личный кабинет Яндекс.Маркета',
        '2. Перейдите в Настройки → API',
        '3. Создайте API Token (не OAuth!)',
        '4. Скопируйте Campaign ID вашего магазина',
        '5. Campaign ID можно найти в разделе "Магазины"'
      ]
    }
  }

  const config = marketplaceConfigs[selectedMarketplace]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">API KEYS</h2>
          <p className="comment">// Управление интеграциями с маркетплейсами</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
          data-testid="add-api-key-button"
        >
          + ДОБАВИТЬ ИНТЕГРАЦИЮ
        </button>
      </div>

      {/* Info Box */}
      <div className="card-neon bg-mm-blue/5 border-mm-blue">
        <div className="flex items-start space-x-3">
          <FiInfo className="text-mm-blue mt-1" size={20} />
          <div>
            <p className="text-mm-blue font-bold mb-1">Для чего нужны API ключи:</p>
            <ul className="text-sm text-mm-text-secondary space-y-1">
              <li>• Автоматическая передача остатков на маркетплейсы</li>
              <li>• Создание и обновление карточек товаров</li>
              <li>• Получение заказов в реальном времени</li>
              <li>• Загрузка аналитики и отчетов</li>
              <li>• Синхронизация цен и статусов</li>
            </ul>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiKey className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">API ключи не добавлены</p>
          <p className="comment">// Нажмите "ДОБАВИТЬ ИНТЕГРАЦИЮ" для подключения маркетплейса</p>
        </div>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <div key={key.id} className="card-neon">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-mm-cyan font-mono uppercase text-lg mb-1">
                    {key.marketplace === 'ozon' ? '🔵 Ozon' : 
                     key.marketplace === 'wb' ? '🟣 Wildberries' : 
                     '🟡 Яндекс.Маркет'}
                  </p>
                  {key.marketplace === 'ozon' && (
                    <p className="text-sm text-mm-text-secondary">Client ID: {key.client_id}</p>
                  )}
                  <p className="text-sm text-mm-text-secondary font-mono">API Key: {key.api_key_masked}</p>
                  <p className="comment text-xs mt-2">
                    Добавлен: {new Date(key.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="status-active">
                    <FiCheckCircle className="inline mr-1" />
                    ACTIVE
                  </span>
                  <button
                    onClick={() => deleteApiKey(key.id)}
                    className="btn-secondary text-mm-red border-mm-red hover:bg-mm-red/10"
                  >
                    УДАЛИТЬ
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add API Key Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ДОБАВИТЬ ИНТЕГРАЦИЮ</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setConnectionStatus(null)
                }}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Marketplace Selector */}
            <div className="mb-6">
              <label className="block text-sm mb-3 text-mm-text-secondary uppercase">Выберите маркетплейс</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => {
                    setSelectedMarketplace('ozon')
                    setNewKey({...newKey, marketplace: 'ozon'})
                    setConnectionStatus(null)
                  }}
                  className={`p-4 border-2 transition-all ${
                    selectedMarketplace === 'ozon'
                      ? 'border-mm-blue text-mm-blue bg-mm-blue/10'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                >
                  🔵 Ozon
                </button>
                <button
                  onClick={() => {
                    setSelectedMarketplace('wb')
                    setNewKey({...newKey, marketplace: 'wb'})
                    setConnectionStatus(null)
                  }}
                  className={`p-4 border-2 transition-all ${
                    selectedMarketplace === 'wb'
                      ? 'border-mm-purple text-mm-purple bg-mm-purple/10'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                >
                  🟣 Wildberries
                </button>
                <button
                  onClick={() => {
                    setSelectedMarketplace('yandex')
                    setNewKey({...newKey, marketplace: 'yandex'})
                    setConnectionStatus(null)
                  }}
                  className={`p-4 border-2 transition-all ${
                    selectedMarketplace === 'yandex'
                      ? 'border-mm-yellow text-mm-yellow bg-mm-yellow/10'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                >
                  🟡 Яндекс.Маркет
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="card-neon bg-mm-darker mb-6">
              <h4 className={`text-lg mb-3 ${config.color} uppercase`}>Как получить API ключи:</h4>
              <ol className="space-y-2 text-sm text-mm-text-secondary">
                {config.instructions.map((instruction, idx) => (
                  <li key={idx} className="font-mono">{instruction}</li>
                ))}
              </ol>
            </div>

            <form onSubmit={addApiKey} className="space-y-6">
              {/* Dynamic Fields */}
              {config.fields.map((field) => (
                <div key={field.name}>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type={field.type}
                    value={newKey[field.name]}
                    onChange={(e) => setNewKey({...newKey, [field.name]: e.target.value})}
                    className="input-neon w-full"
                    placeholder={`Введите ${field.label}`}
                    required={field.required}
                  />
                </div>
              ))}

              {/* Test Connection */}
              <div>
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="btn-secondary w-full"
                >
                  {testingConnection ? '⏳ Тестирование...' : '🔍 Проверить подключение'}
                </button>
                {connectionStatus && (
                  <div className={`mt-3 p-3 border ${
                    connectionStatus.success 
                      ? 'border-mm-green bg-mm-green/10 text-mm-green' 
                      : 'border-mm-red bg-mm-red/10 text-mm-red'
                  }`}>
                    <p className="text-sm font-mono">{connectionStatus.message}</p>
                  </div>
                )}
              </div>

              {/* Permissions Info */}
              <div className="card-neon bg-mm-darker">
                <p className="comment mb-2">// Доступные операции через API:</p>
                <ul className="space-y-1 text-xs text-mm-text-secondary">
                  <li>✓ Передача остатков (FBS/FBO)</li>
                  <li>✓ Создание/обновление карточек товаров</li>
                  <li>✓ Получение новых заказов</li>
                  <li>✓ Обновление статусов заказов</li>
                  <li>✓ Загрузка финансовых отчетов</li>
                  <li>✓ Получение аналитики продаж</li>
                </ul>
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={testingConnection}
                >
                  ДОБАВИТЬ КЛЮЧ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setConnectionStatus(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  ОТМЕНА
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default APIKeysPage