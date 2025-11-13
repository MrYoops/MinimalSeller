import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTrash2, FiEdit, FiDownload } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'

function WarehousesPage() {
  const { api } = useAuth()
  const [tab, setTab] = useState('my')
  const [warehouses, setWarehouses] = useState([])
  const [integrations, setIntegrations] = useState([])
  const [selectedIntegration, setSelectedIntegration] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)
  const [showMPWarehousesModal, setShowMPWarehousesModal] = useState(false)
  const [mpWarehouses, setMpWarehouses] = useState([])
  const [selectedMPWarehouses, setSelectedMPWarehouses] = useState([])

  useEffect(() => {
    loadWarehouses()
    loadIntegrations()
  }, [])

  const loadWarehouses = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/warehouses')
      setWarehouses(response.data)
    } catch (error) {
      console.error('Failed:', error)
    }
    setIsLoading(false)
  }

  const loadIntegrations = async () => {
    try {
      const response = await api.get('/api/seller/api-keys')
      setIntegrations(response.data)
    } catch (error) {
      console.error('Failed:', error)
    }
  }

  const handleSaveWarehouse = async (data) => {
    try {
      if (editingWarehouse) {
        await api.put(`/api/warehouses/${editingWarehouse.id}`, data)
        alert('✅ Склад обновлён!')
      } else {
        await api.post('/api/warehouses', data)
        alert('✅ Склад создан!')
      }
      
      setIsModalOpen(false)
      setEditingWarehouse(null)
      await loadWarehouses()
      
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDelete = async (warehouse) => {
    if (!confirm(`Удалить склад "${warehouse.name}"?`)) return
    
    try {
      await api.delete(`/api/warehouses/${warehouse.id}`)
      alert('✅ Склад удалён!')
      await loadWarehouses()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const loadMPWarehouses = async () => {
    if (!selectedIntegration) {
      alert('Выберите интеграцию!')
      return
    }
    
    try {
      const response = await api.get(`/api/integrations/${selectedIntegration}/warehouses`)
      setMpWarehouses(response.data.warehouses || [])
      setShowMPWarehousesModal(true)
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const addSelectedMPWarehouses = async () => {
    const integration = integrations.find(i => i.id === selectedIntegration)
    if (!integration) return
    
    let added = 0
    
    for (const whId of selectedMPWarehouses) {
      const mpWh = mpWarehouses.find(w => w.id === whId)
      if (!mpWh) continue
      
      try {
        await api.post('/api/warehouses', {
          name: `${integration.marketplace.toUpperCase()} - ${mpWh.name}`,
          type: 'marketplace',
          marketplace_name: integration.marketplace,
          marketplace_warehouse_id: mpWh.id,
          address: '',
          comment: ''
        })
        added++
      } catch (error) {
        console.error('Failed to add:', mpWh.name, error)
      }
    }
    
    alert(`✅ Добавлено складов: ${added}`)
    setShowMPWarehousesModal(false)
    setSelectedMPWarehouses([])
    await loadWarehouses()
  }

  const handleLink = async (warehouseId, mainWarehouseId) => {
    try {
      await api.put(`/api/warehouses/${warehouseId}/link`, {
        main_warehouse_id: mainWarehouseId || null
      })
      await loadWarehouses()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const myWarehouses = warehouses.filter(w => !w.marketplace_name)
  const mpWarehousesData = warehouses.filter(w => w.marketplace_name)
  const mainWarehouses = warehouses.filter(w => w.type === 'main')

  const typeLabels = {
    main: 'Основной',
    marketplace: 'Маркетплейс',
    transit: 'Транзитный'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">СКЛАДЫ</h2>
          <p className="comment">// Управление складами и сопоставление</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setTab('my')}
          className={`px-4 py-3 font-mono uppercase text-sm ${tab === 'my' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary'}`}
        >
          МОИ СКЛАДЫ
        </button>
        <button
          onClick={() => setTab('mp')}
          className={`px-4 py-3 font-mono uppercase text-sm ${tab === 'mp' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary'}`}
        >
          СКЛАДЫ МАРКЕТПЛЕЙСОВ
        </button>
      </div>

      {/* My Warehouses Tab */}
      {tab === 'my' && (
        <MyWarehousesTab
          warehouses={myWarehouses}
          isLoading={isLoading}
          onAdd={() => {
            setEditingWarehouse(null)
            setIsModalOpen(true)
          }}
          onEdit={(wh) => {
            setEditingWarehouse(wh)
            setIsModalOpen(true)
          }}
          onDelete={handleDelete}
          typeLabels={typeLabels}
        />
      )}

      {/* Marketplace Warehouses Tab */}
      {tab === 'mp' && (
        <MPWarehousesTab
          warehouses={mpWarehousesData}
          integrations={integrations}
          selectedIntegration={selectedIntegration}
          setSelectedIntegration={setSelectedIntegration}
          onLoadWarehouses={loadMPWarehouses}
          onDelete={handleDelete}
          onLink={handleLink}
          mainWarehouses={mainWarehouses}
        />
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <WarehouseModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setEditingWarehouse(null)
          }}
          onSave={handleSaveWarehouse}
          existingWarehouses={warehouses}
          editingWarehouse={editingWarehouse}
        />
      )}

      {/* MP Warehouses Selection Modal */}
      {showMPWarehousesModal && (
        <MPWarehousesModal
          isOpen={showMPWarehousesModal}
          onClose={() => {
            setShowMPWarehousesModal(false)
            setSelectedMPWarehouses([])
          }}
          warehouses={mpWarehouses}
          selectedWarehouses={selectedMPWarehouses}
          setSelectedWarehouses={setSelectedMPWarehouses}
          onAdd={addSelectedMPWarehouses}
          marketplace={integrations.find(i => i.id === selectedIntegration)?.marketplace}
        />
      )}
    </div>
  )
}

// Component: My Warehouses Tab
function MyWarehousesTab({ warehouses, isLoading, onAdd, onEdit, onDelete, typeLabels }) {
  if (isLoading) {
    return <div className="text-center py-12"><p className="text-mm-cyan animate-pulse">// LOADING...</p></div>
  }

  if (warehouses.length === 0) {
    return (
      <div className="card-neon text-center py-16">
        <BsBoxSeam className="mx-auto text-mm-text-tertiary mb-6" size={64} />
        <p className="text-mm-text-secondary text-lg mb-6">У вас пока нет ни одного склада...</p>
        <button onClick={onAdd} className="btn-primary">⊕ СОЗДАТЬ ОСНОВНОЙ СКЛАД</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button onClick={onAdd} className="btn-primary">+ ДОБАВИТЬ СКЛАД</button>
      </div>

      <div className="card-neon overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-mm-border">
              <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Название</th>
              <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Тип</th>
              <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Адрес</th>
              <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Комментарий</th>
              <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Действия</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.map((wh) => (
              <tr key={wh.id} className="border-b border-mm-border hover:bg-mm-gray">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    <BsBoxSeam className="text-mm-cyan" />
                    <span className="font-semibold">{wh.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 text-xs font-mono uppercase ${
                    wh.type === 'main' ? 'bg-mm-cyan/20 text-mm-cyan border border-mm-cyan' :
                    wh.type === 'marketplace' ? 'bg-mm-purple/20 text-mm-purple border border-mm-purple' :
                    'bg-mm-yellow/20 text-mm-yellow border border-mm-yellow'
                  }`}>
                    {typeLabels[wh.type]}
                  </span>
                </td>
                <td className="py-4 px-4 text-sm text-mm-text-secondary">{wh.address || '—'}</td>
                <td className="py-4 px-4 text-sm text-mm-text-secondary">{wh.comment || '—'}</td>
                <td className="py-4 px-4 text-right">
                  {wh.type !== 'main' && (
                    <button onClick={() => onDelete(wh)} className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors mr-2">
                      <FiTrash2 size={16} />
                    </button>
                  )}
                  <button onClick={() => onEdit(wh)} className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors">
                    <FiEdit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Component: MP Warehouses Tab
function MPWarehousesTab({ warehouses, integrations, selectedIntegration, setSelectedIntegration, onLoadWarehouses, onDelete, onLink, mainWarehouses }) {
  return (
    <div className="space-y-6">
      <div className="card-neon">
        <div className="flex items-end space-x-4">
          <div className="flex-1">
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Выберите интеграцию</label>
            <select
              value={selectedIntegration}
              onChange={(e) => setSelectedIntegration(e.target.value)}
              className="input-neon w-full"
            >
              <option value="">Выберите интеграцию...</option>
              {integrations.map(int => (
                <option key={int.id} value={int.id}>
                  {int.marketplace.toUpperCase()} - Интеграция
                </option>
              ))}
            </select>
            <p className="comment text-xs mt-1">// Настраиваются во вкладке API KEYS</p>
          </div>
          <button
            onClick={onLoadWarehouses}
            disabled={!selectedIntegration}
            className="btn-primary disabled:opacity-50"
          >
            <FiDownload className="inline mr-2" />
            ЗАГРУЗИТЬ СКЛАДЫ С МП
          </button>
        </div>
      </div>

      {warehouses.length === 0 ? (
        <div className="card-neon text-center py-12">
          <p className="text-mm-text-secondary">Склады маркетплейсов не загружены</p>
          <p className="comment text-sm mt-2">// Выберите интеграцию и нажмите "ЗАГРУЗИТЬ СКЛАДЫ С МП"</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Название склада</th>
                <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Синхронизация с</th>
                <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Действия</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((wh) => (
                <tr key={wh.id} className="border-b border-mm-border hover:bg-mm-gray">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <BsBoxSeam className="text-mm-purple" />
                      <div>
                        <div className="font-semibold">{wh.name}</div>
                        <div className="text-xs text-mm-text-tertiary">ID на МП: {wh.marketplace_warehouse_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <select
                      value={wh.sync_with_main_warehouse_id || ''}
                      onChange={(e) => onLink(wh.id, e.target.value)}
                      className="input-neon text-sm"
                    >
                      <option value="">-- Выберите основной склад --</option>
                      {mainWarehouses.map(mw => (
                        <option key={mw.id} value={mw.id}>⭐ {mw.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-4 px-4 text-right">
                    <button onClick={() => onDelete(wh)} className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors">
                      <FiTrash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Modal: Create/Edit Warehouse
function WarehouseModal({ isOpen, onClose, onSave, existingWarehouses, editingWarehouse }) {
  const [name, setName] = useState(editingWarehouse?.name || '')
  const [type, setType] = useState(editingWarehouse?.type || 'main')
  const [address, setAddress] = useState(editingWarehouse?.address || '')
  const [comment, setComment] = useState(editingWarehouse?.comment || '')

  const hasMainWarehouse = existingWarehouses.some(w => w.type === 'main')
  const isEditing = !!editingWarehouse

  useEffect(() => {
    if (editingWarehouse) {
      setName(editingWarehouse.name)
      setType(editingWarehouse.type)
      setAddress(editingWarehouse.address || '')
      setComment(editingWarehouse.comment || '')
    }
  }, [editingWarehouse])

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = isEditing ? { name, address, comment } : { name, type, address, comment }
    onSave(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="card-neon max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan">{isEditing ? 'РЕДАКТИРОВАТЬ СКЛАД' : 'СОЗДАТЬ СКЛАД'}</h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название склада *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-neon w-full" placeholder="Например: Основной склад" required />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тип склада *</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input-neon w-full" disabled={!hasMainWarehouse}>
                <option value="main">Основной</option>
                {hasMainWarehouse && <option value="marketplace">Маркетплейс</option>}
                {hasMainWarehouse && <option value="transit">Транзитный</option>}
              </select>
              <p className="comment text-xs mt-1">{!hasMainWarehouse ? '// Первый склад должен быть Основным' : '// Основной склад уже создан'}</p>
            </div>
          )}

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Адрес</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="input-neon w-full" placeholder="г. Москва, ул. Ленина, 1" />
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Комментарий</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="input-neon w-full" rows="3" placeholder="Дополнительная информация" />
          </div>

          <div className="flex space-x-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">ОТМЕНА</button>
            <button type="submit" disabled={!name} className="btn-primary flex-1 disabled:opacity-50">{isEditing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Modal: MP Warehouses Selection
function MPWarehousesModal({ isOpen, onClose, warehouses, selectedWarehouses, setSelectedWarehouses, onAdd, marketplace }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="card-neon max-w-3xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan">ДОСТУПНЫЕ СКЛАДЫ ДЛЯ ДОБАВЛЕНИЯ</h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red">✕</button>
        </div>

        <p className="text-mm-text-secondary mb-6">Склады, найденные на {marketplace?.toUpperCase()}</p>

        <div className="card-neon bg-mm-darker overflow-hidden mb-6 max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-mm-border">
                <th className="py-3 px-4 text-left"><input type="checkbox" className="w-4 h-4" /></th>
                <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm">Название склада</th>
                <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm">ID склада на МП</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((wh) => (
                <tr key={wh.id} className="border-b border-mm-border hover:bg-mm-gray">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedWarehouses.includes(wh.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWarehouses([...selectedWarehouses, wh.id])
                        } else {
                          setSelectedWarehouses(selectedWarehouses.filter(id => id !== wh.id))
                        }
                      }}
                      className="w-4 h-4"
                    />
                  </td>
                  <td className="py-3 px-4 font-semibold">{wh.name}</td>
                  <td className="py-3 px-4 font-mono text-sm text-mm-text-secondary">{wh.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex space-x-4">
          <button onClick={onClose} className="btn-secondary flex-1">ОТМЕНА</button>
          <button onClick={onAdd} disabled={selectedWarehouses.length === 0} className="btn-primary flex-1 disabled:opacity-50">
            ⬇️ ДОБАВИТЬ ВЫБРАННЫЕ ({selectedWarehouses.length})
          </button>
        </div>
      </div>
    </div>
  )
}

export default WarehousesPage
