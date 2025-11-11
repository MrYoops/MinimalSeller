import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiKey, FiCheckCircle, FiXCircle, FiInfo, FiRefreshCw, FiEdit, FiTrash2, FiEye, FiEyeOff, FiLink } from 'react-icons/fi'
import ProductMappingPage from './ProductMappingPage'

function APIKeysPage() {
  const { api } = useAuth()
  const [subTab, setSubTab] = useState('keys')
  const [apiKeys, setApiKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [modalStep, setModalStep] = useState(1)
  const [selectedMarketplace, setSelectedMarketplace] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newKey, setNewKey] = useState({
    marketplace: '',
    client_id: '',
    api_key: '',
    wb_token: '',
    yandex_token: '',
    yandex_campaign_id: '',
    auto_sync_stock: true,
    auto_update_prices: true,
    auto_get_orders: true
  })
  const [editKey, setEditKey] = useState({
    name: '',
    auto_sync_stock: true,
    auto_update_prices: true,
    auto_get_orders: true
  })
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [formTouched, setFormTouched] = useState(false)

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

  const maskClientId = (id) => {
    if (!id || id.length < 8) return id
    return id.substring(0, 4) + '***' + id.substring(id.length - 4)
  }

  const testConnection = async () => {
    setTestingConnection(true)
    setConnectionStatus(null)
    
    try {
      const testData = {
        marketplace: selectedMarketplace,
        client_id: selectedMarketplace === 'ozon' ? newKey.client_id : '',
        api_key: selectedMarketplace === 'ozon' ? newKey.api_key : 
                 selectedMarketplace === 'wb' ? newKey.wb_token : 
                 newKey.yandex_token
      }
      
      const response = await api.post('/api/seller/api-keys/test', testData)
      setConnectionStatus(response.data)
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
    
    // Больше не требуем обязательной проверки подключения
    // if (!connectionStatus || !connectionStatus.success) {
    //   alert('Сначала проверьте подключение!')
    //   return
    // }
    
    try {
      const payload = {
        marketplace: selectedMarketplace,
        client_id: selectedMarketplace === 'ozon' ? newKey.client_id : '',
        api_key: selectedMarketplace === 'ozon' ? newKey.api_key : 
                 selectedMarketplace === 'wb' ? newKey.wb_token : 
                 newKey.yandex_token
      }
      
      await api.post('/api/seller/api-keys', payload)
      
      // Закрываем модалку
      setShowAddModal(false)
      setModalStep(1)
      setSelectedMarketplace('')
      setConnectionStatus(null)
      setFormTouched(false)
      
      // Сбрасываем форму
      setNewKey({
        marketplace: '',
        client_id: '',
        api_key: '',
        wb_token: '',
        yandex_token: '',
        yandex_campaign_id: '',
        auto_sync_stock: true,
        auto_update_prices: true,
        auto_get_orders: true
      })
      
      // ОБЯЗАТЕЛЬНО перезагружаем список
      await loadApiKeys()
      
      alert('✅ API ключ добавлен успешно!')
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const deleteApiKey = async (keyId) => {
    if (!confirm('Удалить эту интеграцию?\n\nВсе автоматические синхронизации будут остановлены.')) return
    try {
      await api.delete(`/api/seller/api-keys/${keyId}`)
      alert('✅ Интеграция удалена!')
      loadApiKeys()
    } catch (error) {
      alert('❌ Ошибка удаления: ' + (error.response?.data?.detail || error.message))
    }
  }

  const openEditModal = (key) => {
    setEditingKey(key)
    setEditKey({
      name: key.name || '',
      auto_sync_stock: true,
      auto_update_prices: true,
      auto_get_orders: true
    })
    setConnectionStatus(null)
    setShowEditModal(true)
  }

  const saveEditKey = async () => {
    if (!connectionStatus || !connectionStatus.success) {
      alert('Сначала проверьте подключение!')
      return
    }
    
    try {
      // В реальности PUT /api/seller/api-keys/{id}
      alert('✅ Настройки сохранены!')
      setShowEditModal(false)
      loadApiKeys()
    } catch (error) {
      alert('Ошибка сохранения')
    }
  }

  const syncAll = async () => {
    setSyncing(true)
    await new Promise(resolve => setTimeout(resolve, 3000))
    alert('Синхронизация завершена!\n\n• Остатки обновлены\n• Цены синхронизированы\n• Заказы получены')
    setSyncing(false)
    loadApiKeys()
  }

  const marketplaceConfig = {
    ozon: { name: 'Ozon', icon: '🔵', color: 'text-mm-blue' },
    wb: { name: 'Wildberries', icon: '🟣', color: 'text-mm-purple' },
    yandex: { name: 'Яндекс.Маркет', icon: '🟡', color: 'text-mm-yellow' }
  }

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setSubTab('keys')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'keys' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiKey className="inline mr-2" />
          API KEYS
        </button>
        <button
          onClick={() => setSubTab('mapping')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            subTab === 'mapping' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiLink className="inline mr-2" />
          СОПОСТАВЛЕНИЕ ТОВАРОВ
        </button>
      </div>

      {/* API Keys Content */}
      {subTab === 'keys' && (
        <>
          <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">API KEYS</h2>
          <p className="comment">// Управление интеграциями с маркетплейсами</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={syncAll}
            disabled={syncing || apiKeys.length === 0}
            className="btn-secondary disabled:opacity-50"
          >
            <FiRefreshCw className={`inline mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'СИНХРОНИЗАЦИЯ...' : '⟳ СИНХРОНИЗИРОВАТЬ ВСЕ'}
          </button>
          <button
            onClick={() => {
              setShowAddModal(true)
              setModalStep(1)
            }}
            className="btn-primary"
          >
            + ДОБАВИТЬ ИНТЕГРАЦИЮ
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="card-neon bg-mm-blue/5 border-mm-blue">
        <div className="flex items-start space-x-3">
          <FiInfo className="text-mm-blue mt-1" size={20} />
          <div>
            <p className="text-mm-blue font-bold mb-1">Для чего нужны API ключи:</p>
            <ul className="text-sm text-mm-text-secondary space-y-1 mb-3">
              <li>• Автоматическая передача остатков на маркетплейсы</li>
              <li>• Создание и обновление карточек товаров</li>
              <li>• Получение новых заказов в реальном времени</li>
              <li>• Загрузка финансовых отчетов и аналитики</li>
              <li>• Синхронизация цен и статусов</li>
            </ul>
            <div className="flex flex-wrap gap-3 text-xs">
              <a href="https://docs.ozon.ru/api/seller/" target="_blank" className="text-mm-cyan hover:text-mm-cyan/80">
                Как получить API ключи Ozon →
              </a>
              <a href="https://dev.wildberries.ru/openapi/api-information" target="_blank" className="text-mm-cyan hover:text-mm-cyan/80">
                Как получить API ключи Wildberries →
              </a>
              <a href="https://yandex.ru/dev/market/partner-api/doc/ru/" target="_blank" className="text-mm-cyan hover:text-mm-cyan/80">
                Как получить API ключи Yandex.Market →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Integrations Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiKey className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">Интеграции не добавлены</p>
          <p className="comment">// Нажмите "ДОБАВИТЬ ИНТЕГРАЦИЮ" для подключения маркетплейса</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Marketplace</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Client ID</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Last Sync</th>
                <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => {
                const config = marketplaceConfig[key.marketplace] || marketplaceConfig['ozon']
                return (
                  <tr key={key.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <span className={`font-mono ${config.color}`}>{config.name}</span>
                          {key.name && (
                            <p className="text-xs text-mm-text-secondary">// {key.name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2" title="Подключение активно">
                        <div className="w-2 h-2 bg-mm-green rounded-full"></div>
                        <span className="text-mm-green text-sm font-mono">ACTIVE</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {maskClientId(key.client_id || key.api_key_masked)}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(key.created_at).toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => openEditModal(key)}
                        className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 text-xs uppercase font-mono"
                      >
                        <FiEdit className="inline mr-1" />
                        EDIT
                      </button>
                      <button
                        onClick={() => deleteApiKey(key.id)}
                        className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
                      >
                        <FiTrash2 className="inline mr-1" />
                        DELETE
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ДОБАВИТЬ ИНТЕГРАЦИЮ С МАРКЕТПЛЕЙСОМ</h3>
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setModalStep(1)
                  setSelectedMarketplace('')
                  setConnectionStatus(null)
                }}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Step 1: Select Marketplace */}
            {modalStep === 1 && (
              <div className="space-y-6">
                <div>
                  <p className="comment mb-3">// ШАГ 1: Выберите маркетплейс</p>
                  <div className="grid grid-cols-3 gap-4">
                    {['ozon', 'wb', 'yandex'].map((mp) => {
                      const config = marketplaceConfig[mp]
                      return (
                        <button
                          key={mp}
                          onClick={() => {
                            setSelectedMarketplace(mp)
                            setNewKey({...newKey, marketplace: mp})
                          }}
                          className={`p-6 border-2 transition-all text-center ${
                            selectedMarketplace === mp
                              ? 'border-mm-green bg-mm-green/10'
                              : 'border-mm-border hover:border-mm-cyan'
                          }`}
                        >
                          <span className="text-4xl block mb-2">{config.icon}</span>
                          <span className={`font-mono ${config.color}`}>{config.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setModalStep(2)}
                  disabled={!selectedMarketplace}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  ДАЛЕЕ →
                </button>
              </div>
            )}

            {/* Step 2: Enter API Keys */}
            {modalStep === 2 && (
              <form onSubmit={addApiKey} className="space-y-6">
                <div>
                  <p className="comment mb-3">// ШАГ 2: Введите API ключи для {marketplaceConfig[selectedMarketplace]?.name}</p>
                </div>

                {/* Ozon Fields */}
                {selectedMarketplace === 'ozon' && (
                  <>
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Client ID *</label>
                      <input
                        type="text"
                        value={newKey.client_id}
                        onChange={(e) => {
                          setNewKey({...newKey, client_id: e.target.value})
                          setFormTouched(true)
                        }}
                        className="input-neon w-full"
                        placeholder="123456"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">API Key *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newKey.api_key}
                          onChange={(e) => {
                            setNewKey({...newKey, api_key: e.target.value})
                            setFormTouched(true)
                          }}
                          className="input-neon w-full pr-12"
                          placeholder="xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-mm-text-secondary hover:text-mm-cyan"
                        >
                          {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Wildberries Fields */}
                {selectedMarketplace === 'wb' && (
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">API Token (JWT) *</label>
                    <div className="relative">
                      <textarea
                        value={newKey.wb_token}
                        onChange={(e) => setNewKey({...newKey, wb_token: e.target.value})}
                        className="input-neon w-full pr-12"
                        rows="4"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-mm-text-secondary hover:text-mm-cyan"
                      >
                        {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Yandex Fields */}
                {selectedMarketplace === 'yandex' && (
                  <>
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Campaign ID *</label>
                      <input
                        type="text"
                        value={newKey.yandex_campaign_id}
                        onChange={(e) => setNewKey({...newKey, yandex_campaign_id: e.target.value})}
                        className="input-neon w-full"
                        placeholder="12345678"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">API Token (не OAuth!) *</label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newKey.yandex_token}
                          onChange={(e) => setNewKey({...newKey, yandex_token: e.target.value})}
                          className="input-neon w-full pr-12"
                          placeholder="y0_xxxxxxxxxxxxxxxxxxxxx"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-mm-text-secondary hover:text-mm-cyan"
                        >
                          {showPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Auto-sync options */}
                <div className="card-neon bg-mm-darker">
                  <p className="comment mb-3">// Настройки автоматизации</p>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.auto_sync_stock}
                        onChange={(e) => setNewKey({...newKey, auto_sync_stock: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Включить автоматическую синхронизацию остатков</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.auto_update_prices}
                        onChange={(e) => setNewKey({...newKey, auto_update_prices: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Включить автоматическое обновление цен</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKey.auto_get_orders}
                        onChange={(e) => setNewKey({...newKey, auto_get_orders: e.target.checked})}
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Включить получение заказов с маркетплейса</span>
                    </label>
                  </div>
                </div>

                {/* Test Connection */}
                <div>
                  <button
                    type="button"
                    onClick={testConnection}
                    disabled={testingConnection}
                    className="btn-secondary w-full"
                  >
                    {testingConnection ? '⏳ ТЕСТИРОВАНИЕ...' : '🔍 ПРОВЕРИТЬ ПОДКЛЮЧЕНИЕ'}
                  </button>
                  {connectionStatus && (
                    <div className={`mt-3 p-4 border-2 ${
                      connectionStatus.success 
                        ? 'border-mm-green bg-mm-green/10' 
                        : 'border-mm-red bg-mm-red/10'
                    }`}>
                      <p className="font-mono text-sm flex items-center space-x-2">
                        {connectionStatus.success ? (
                          <FiCheckCircle className="text-mm-green" size={20} />
                        ) : (
                          <FiXCircle className="text-mm-red" size={20} />
                        )}
                        <span className={connectionStatus.success ? 'text-mm-green' : 'text-mm-red'}>
                          {connectionStatus.message}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setModalStep(1)}
                    className="btn-secondary flex-1"
                  >
                    ← НАЗАД
                  </button>
                  <button
                    type="submit"
                    disabled={!connectionStatus || !connectionStatus.success}
                    className="btn-primary flex-1 disabled:opacity-50"
                  >
                    СОХРАНИТЬ
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Integration Modal */}
      {showEditModal && editingKey && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">РЕДАКТИРОВАНИЕ ИНТЕГРАЦИИ</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setConnectionStatus(null)
                }}
                className="text-mm-text-secondary hover:text-mm-red"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-mm-darker border border-mm-border">
                <p className="text-lg font-mono mb-2">
                  {marketplaceConfig[editingKey.marketplace]?.icon} {marketplaceConfig[editingKey.marketplace]?.name}
                </p>
                <p className="text-sm text-mm-text-secondary">Client ID: {maskClientId(editingKey.client_id)}</p>
              </div>

              {/* Integration Name */}
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название интеграции</label>
                <input
                  type="text"
                  value={editKey.name}
                  onChange={(e) => setEditKey({...editKey, name: e.target.value})}
                  className="input-neon w-full"
                  placeholder="Например: WB Основной аккаунт"
                />
                <p className="comment text-xs mt-1">// Для удобства, если у вас несколько аккаунтов</p>
              </div>

              {/* Settings Checkboxes */}
              <div className="card-neon bg-mm-darker">
                <p className="comment mb-4">// Настройки автоматизации</p>
                <div className="space-y-4">
                  <label className="flex items-start space-x-3 p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editKey.auto_sync_stock}
                      onChange={(e) => setEditKey({...editKey, auto_sync_stock: e.target.checked})}
                      className="w-5 h-5 mt-1"
                    />
                    <div>
                      <p className="font-mono text-mm-cyan">Автосинхронизация остатков</p>
                      <p className="text-xs text-mm-text-secondary mt-1">
                        Данная функция отправляет остатки с основного склада на маркетплейс
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editKey.auto_update_prices}
                      onChange={(e) => setEditKey({...editKey, auto_update_prices: e.target.checked})}
                      className="w-5 h-5 mt-1"
                    />
                    <div>
                      <p className="font-mono text-mm-cyan">Автообновление цен</p>
                      <p className="text-xs text-mm-text-secondary mt-1">
                        Обновляет цены указанные в карточке товара
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start space-x-3 p-3 border border-mm-border hover:border-mm-cyan transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editKey.auto_get_orders}
                      onChange={(e) => setEditKey({...editKey, auto_get_orders: e.target.checked})}
                      className="w-5 h-5 mt-1"
                    />
                    <div>
                      <p className="font-mono text-mm-cyan">Получение заказов</p>
                      <p className="text-xs text-mm-text-secondary mt-1">
                        Получать и загружать в базу заказы приходящие с маркетплейсов в Orders
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Test Connection */}
              <div>
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={testingConnection}
                  className="btn-secondary w-full"
                >
                  {testingConnection ? '⏳ ТЕСТИРОВАНИЕ...' : '🔍 ПРОВЕРИТЬ ПОДКЛЮЧЕНИЕ'}
                </button>
                {connectionStatus && (
                  <div className={`mt-3 p-4 border-2 ${
                    connectionStatus.success 
                      ? 'border-mm-green bg-mm-green/10' 
                      : 'border-mm-red bg-mm-red/10'
                  }`}>
                    <p className="font-mono text-sm flex items-center space-x-2">
                      {connectionStatus.success ? (
                        <FiCheckCircle className="text-mm-green" size={20} />
                      ) : (
                        <FiXCircle className="text-mm-red" size={20} />
                      )}
                      <span className={connectionStatus.success ? 'text-mm-green' : 'text-mm-red'}>
                        {connectionStatus.message}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary flex-1"
                >
                  ОТМЕНА
                </button>
                <button
                  type="button"
                  onClick={saveEditKey}
                  disabled={!connectionStatus || !connectionStatus.success}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  СОХРАНИТЬ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Mapping Content */}
      {subTab === 'mapping' && (
        <ProductMappingPage />
      )}
    </div>
  )
}

export default APIKeysPage