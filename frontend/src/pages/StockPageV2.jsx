import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDownload, FiRefreshCw, FiSearch } from 'react-icons/fi'
import { toast } from 'sonner'

function StockPageV2() {
  const { api } = useAuth()
  const [stocks, setStocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [integrations, setIntegrations] = useState([])

  useEffect(() => {
    loadStocks()
    loadIntegrations()
  }, [])

  const loadStocks = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/inventory/fbs')
      setStocks(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки остатков')
      console.error(error)
    }
    setLoading(false)
  }

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed to load integrations:', error)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl text-mm-cyan uppercase mb-2">Остатки на складах</h2>
          <p className="text-mm-text-secondary text-sm">Управление остатками товаров</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-secondary flex items-center space-x-2"
            data-testid="import-stocks-btn"
          >
            <FiDownload />
            <span>ПЕРЕНЕСТИ ОСТАТКИ С МП</span>
          </button>
          <button
            onClick={loadStocks}
            className="btn-secondary flex items-center space-x-2"
            data-testid="refresh-btn"
          >
            <FiRefreshCw />
            <span>ОБНОВИТЬ</span>
          </button>
        </div>
      </div>

      {/* Stocks Table */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : stocks.length === 0 ? (
        <div className="card-neon text-center py-16">
          <p className="text-mm-text-secondary text-lg mb-2">Нет остатков</p>
          <p className="text-sm text-mm-text-tertiary mb-6">Создайте приёмку или перенесите остатки с МП</p>
          <button
            onClick={() => setShowImportModal(true)}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <FiDownload />
            <span>ПЕРЕНЕСТИ ОСТАТКИ С МП</span>
          </button>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Название</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Всего</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Резерв</th>
                <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Доступно</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((item) => (
                <tr key={item.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                  <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.sku}</td>
                  <td className="py-4 px-4 text-sm">{item.product_name || '—'}</td>
                  <td className="py-4 px-4 text-center font-mono font-bold">{item.quantity}</td>
                  <td className="py-4 px-4 text-center font-mono text-mm-yellow">{item.reserved}</td>
                  <td className="py-4 px-4 text-center font-mono font-bold text-mm-green">{item.available}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportStocksModal
          integrations={integrations}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            loadStocks()
          }}
        />
      )}
    </div>
  )
}

function ImportStocksModal({ integrations, onClose, onSuccess }) {
  const { api } = useAuth()
  const [selectedMarketplace, setSelectedMarketplace] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    if (!selectedMarketplace) {
      toast.error('Выберите маркетплейс')
      return
    }

    if (!confirm('Перенести остатки с маркетплейса? Это обновит остатки в системе.')) return

    setLoading(true)
    try {
      const response = await api.post('/api/stock-operations/import-from-marketplace', {
        marketplace: selectedMarketplace
      })
      
      toast.success(`✅ ${response.data.message}`)
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка переноса остатков')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50" data-testid="import-modal">
      <div className="card-neon max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan uppercase">Перенос остатков</h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red transition-colors">✕</button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Маркетплейс</label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="input-neon w-full"
              data-testid="marketplace-select"
            >
              <option value="">Выберите маркетплейс...</option>
              {integrations.map(int => (
                <option key={int.id} value={int.marketplace}>
                  {int.name || int.marketplace.toUpperCase()}
                </option>
              ))}
            </select>
            <p className="text-xs text-mm-text-tertiary mt-2">
              Остатки с МП будут загружены и сохранены в систему
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
              data-testid="cancel-btn"
            >
              ОТМЕНА
            </button>
            <button
              onClick={handleImport}
              disabled={!selectedMarketplace || loading}
              className="btn-primary flex-1 disabled:opacity-50"
              data-testid="import-btn"
            >
              {loading ? 'ЗАГРУЗКА...' : 'ПЕРЕНЕСТИ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StockPageV2
