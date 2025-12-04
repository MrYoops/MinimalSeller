import React, { useState, useEffect } from 'react'
import { FiX, FiDownload } from 'react-icons/fi'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'

function ImportOrdersModal({ type = 'fbs', onClose, onSuccess }) {
  const { api } = useAuth()
  const [importing, setImporting] = useState(false)
  const [integrations, setIntegrations] = useState([])
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)
  
  const [settings, setSettings] = useState({
    integration_id: '',  // ID интеграции
    date_from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    date_to: new Date().toISOString().split('T')[0],
    update_stock: true
  })

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      setLoadingIntegrations(true)
      const response = await api.get('/api/seller/api-keys')
      const keys = response.data || []
      
      // Фильтровать по типу (FBS или FBO)
      const filtered = type === 'fbo' 
        ? keys.filter(k => k.marketplace === 'ozon')  // Только Ozon поддерживает FBO
        : keys  // Все интеграции
      
      setIntegrations(filtered)
      
      // Автовыбор первой
      if (filtered.length > 0) {
        setSettings(prev => ({...prev, integration_id: filtered[0].id}))
      }
    } catch (error) {
      console.error('Failed to load integrations:', error)
      toast.error('Ошибка загрузки интеграций')
    } finally {
      setLoadingIntegrations(false)
    }
  }

  const handleImport = async () => {
    if (!settings.integration_id) {
      toast.error('Выберите интеграцию')
      return
    }
    
    if (!settings.date_from || !settings.date_to) {
      toast.error('Выберите период')
      return
    }
    
    try {
      setImporting(true)
      
      const endpoint = type === 'fbs' ? '/api/orders/fbs/import' : '/api/orders/fbo/import'
      const payload = type === 'fbs' 
        ? { ...settings }
        : { integration_id: settings.integration_id, date_from: settings.date_from, date_to: settings.date_to }
      
      const response = await api.post(endpoint, payload)
      
      const msg = type === 'fbs' && settings.update_stock
        ? `Загружено ${response.data.imported} заказов, списано ${response.data.stock_updated} товаров`
        : `Загружено ${response.data.imported} заказов (без обновления остатков)`
      
      toast.success(msg)
      onSuccess()
      onClose()
      
    } catch (error) {
      console.error('Failed to import orders:', error)
      toast.error(error.response?.data?.detail || 'Ошибка загрузки заказов')
    } finally {
      setImporting(false)
    }
  }

  const getIntegrationLabel = (integration) => {
    const mpNames = {
      'ozon': 'Ozon',
      'wb': 'Wildberries',
      'yandex': 'Yandex Market'
    }
    const mpName = mpNames[integration.marketplace] || integration.marketplace
    return integration.name || `${mpName} (${integration.client_id || 'API'})`
  }

  if (loadingIntegrations) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="bg-mm-darker border border-mm-cyan rounded-lg p-6">
          <p className="text-mm-cyan font-mono">Загрузка интеграций...</p>
        </div>
      </div>
    )
  }

  if (integrations.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-mm-darker border border-mm-red rounded-lg p-6 max-w-md" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-xl font-mono text-mm-red mb-4">❗ Интеграции не найдены</h3>
          <p className="text-mm-text-secondary mb-4">
            {type === 'fbo' 
              ? 'Для загрузки FBO заказов необходима интеграция Ozon.'
              : 'Не настроено ни одной интеграции с маркетплейсами.'}
          </p>
          <p className="text-sm text-mm-text-tertiary mb-4">
            Перейдите в раздел "Интеграции" и добавьте API ключи.
          </p>
          <button onClick={onClose} className="btn-neon w-full">
            Закрыть
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-mm-darker border border-mm-cyan rounded-lg p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-mono text-mm-cyan uppercase">
            Импорт заказов {type === 'fbs' ? 'FBS' : 'FBO'}
          </h3>
          <button
            onClick={onClose}
            className="text-mm-text-secondary hover:text-mm-cyan transition-colors"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Форма */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono text-mm-text-secondary mb-2">Интеграция *</label>
            <select
              className="input-neon w-full"
              value={settings.integration_id}
              onChange={(e) => setSettings({...settings, integration_id: e.target.value})}
            >
              {integrations.map(integration => (
                <option key={integration.id} value={integration.id}>
                  {getIntegrationLabel(integration)}
                </option>
              ))}
            </select>
            <p className="text-xs text-mm-text-tertiary mt-1">// Выберите настроенную интеграцию из раздела "Интеграции"</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата от *</label>
              <input
                type="date"
                className="input-neon w-full"
                value={settings.date_from}
                onChange={(e) => setSettings({...settings, date_from: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата до *</label>
              <input
                type="date"
                className="input-neon w-full"
                value={settings.date_to}
                onChange={(e) => setSettings({...settings, date_to: e.target.value})}
              />
            </div>
          </div>

          {type === 'fbs' && (
            <label className="flex items-center space-x-3 border border-mm-border p-4 rounded hover:border-mm-cyan transition-colors cursor-pointer">
              <input
                type="checkbox"
                checked={settings.update_stock}
                onChange={(e) => setSettings({...settings, update_stock: e.target.checked})}
                className="toggle-switch"
              />
              <div>
                <div className="font-semibold text-mm-text">Обновить остатки</div>
                <div className="text-xs text-mm-text-tertiary">Списать товары со склада при загрузке</div>
              </div>
            </label>
          )}

          {type === 'fbo' && (
            <div className="bg-mm-purple/10 border border-mm-purple p-4 rounded">
              <p className="text-sm text-mm-text-secondary font-mono">
                ℹ️ FBO заказы загружаются БЕЗ обновления остатков (только для аналитики)
              </p>
            </div>
          )}

          {/* Кнопки */}
          <div className="flex justify-end space-x-4 pt-4">
            <button
              onClick={onClose}
              className="btn-neon-outline"
              disabled={importing}
            >
              Отмена
            </button>
            <button
              onClick={handleImport}
              disabled={importing}
              className="btn-neon flex items-center space-x-2"
            >
              <FiDownload />
              <span>{importing ? 'Загрузка...' : 'ЗАГРУЗИТЬ ЗАКАЗЫ'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImportOrdersModal
