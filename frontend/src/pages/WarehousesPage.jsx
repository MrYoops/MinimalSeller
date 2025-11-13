import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTrash2, FiEdit, FiPackage } from 'react-icons/fi'
import { BsBoxSeam } from 'react-icons/bs'

function WarehousesPage() {
  const { api } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)

  useEffect(() => {
    loadWarehouses()
  }, [])

  const loadWarehouses = async () => {
    setIsLoading(true)
    try {
      const response = await api.get('/api/warehouses')
      setWarehouses(response.data)
    } catch (error) {
      console.error('Failed to load warehouses:', error)
      alert('Ошибка загрузки складов: ' + (error.response?.data?.detail || error.message))
    }
    setIsLoading(false)
  }

  const handleSaveWarehouse = async (data) => {
    try {
      if (editingWarehouse) {
        // Update existing
        await api.put(`/api/warehouses/${editingWarehouse.id}`, data)
        alert('✅ Склад обновлён!')
      } else {
        // Create new
        const response = await api.post('/api/warehouses', data)
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

  const typeLabels = {
    main: 'Основной',
    marketplace: 'Маркетплейс',
    transit: 'Транзитный'
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  if (warehouses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl mb-2 text-mm-cyan uppercase">СКЛАДЫ</h2>
            <p className="comment">// Управление складами</p>
          </div>
        </div>

        <div className="card-neon text-center py-16">
          <BsBoxSeam className="mx-auto text-mm-text-tertiary mb-6" size={64} />
          <p className="text-mm-text-secondary text-lg mb-6">У вас пока нет ни одного склада...</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn-primary"
          >
            ⊕ СОЗДАТЬ ОСНОВНОЙ СКЛАД
          </button>
        </div>

        {isModalOpen && (
          <WarehouseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveWarehouse}
            existingWarehouses={warehouses}
            editingWarehouse={editingWarehouse}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">СКЛАДЫ</h2>
          <p className="comment">// Управление складами</p>
        </div>
        <button
          onClick={() => {
            setEditingWarehouse(null)
            setIsModalOpen(true)
          }}
          className="btn-primary"
        >
          + ДОБАВИТЬ СКЛАД
        </button>
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
            {warehouses.map((warehouse) => (
              <tr key={warehouse.id} className="border-b border-mm-border hover:bg-mm-gray">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    <BsBoxSeam className="text-mm-cyan" />
                    <span className="font-semibold">{warehouse.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1 text-xs font-mono uppercase ${
                    warehouse.type === 'main' ? 'bg-mm-cyan/20 text-mm-cyan border border-mm-cyan' :
                    warehouse.type === 'marketplace' ? 'bg-mm-purple/20 text-mm-purple border border-mm-purple' :
                    'bg-mm-yellow/20 text-mm-yellow border border-mm-yellow'
                  }`}>
                    {typeLabels[warehouse.type]}
                  </span>
                </td>
                <td className="py-4 px-4 text-sm text-mm-text-secondary">
                  {warehouse.address || '—'}
                </td>
                <td className="py-4 px-4 text-sm text-mm-text-secondary">
                  {warehouse.comment || '—'}
                </td>
                <td className="py-4 px-4 text-right">
                  {warehouse.type !== 'main' && (
                    <button
                      onClick={() => handleDelete(warehouse)}
                      className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors mr-2"
                      title="Удалить склад"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingWarehouse(warehouse)
                      setIsModalOpen(true)
                    }}
                    className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
                    title="Редактировать склад"
                  >
                    <FiEdit size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}

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
    
    const data = isEditing 
      ? { name, address, comment }  // При редактировании не отправляем type
      : { name, type, address, comment }
    
    onSave(data)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
      <div className="card-neon max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan">
            {isEditing ? 'РЕДАКТИРОВАТЬ СКЛАД' : 'СОЗДАТЬ СКЛАД'}
          </h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название склада *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-neon w-full"
              placeholder="Например: Основной склад"
              required
            />
          </div>

          {!isEditing && (
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Тип склада *</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="input-neon w-full"
                disabled={!hasMainWarehouse}
              >
                <option value="main">Основной</option>
                {hasMainWarehouse && <option value="marketplace">Маркетплейс</option>}
                {hasMainWarehouse && <option value="transit">Транзитный</option>}
              </select>
              <p className="comment text-xs mt-1">
                {!hasMainWarehouse 
                  ? '// Первый склад должен быть Основным' 
                  : '// Основной склад уже создан'}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Адрес</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="input-neon w-full"
              placeholder="Например: г. Москва, ул. Ленина, 1"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Комментарий</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="input-neon w-full"
              rows="3"
              placeholder="Дополнительная информация"
            />
          </div>

          <div className="flex space-x-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">ОТМЕНА</button>
            <button type="submit" disabled={!name} className="btn-primary flex-1 disabled:opacity-50">
              {isEditing ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default WarehousesPage
