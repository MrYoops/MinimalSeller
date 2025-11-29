import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiPlus, FiEdit, FiTrash2, FiX, FiUser } from 'react-icons/fi'
import { toast } from 'sonner'

function SuppliersPage() {
  const { api } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)

  useEffect(() => {
    loadSuppliers()
  }, [])

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/suppliers')
      setSuppliers(response.data)
    } catch (error) {
      toast.error('Ошибка загрузки поставщиков')
      console.error(error)
    }
    setLoading(false)
  }

  const handleDelete = async (supplier) => {
    if (!confirm(`Удалить поставщика "${supplier.name}"?`)) return
    
    try {
      await api.delete(`/api/suppliers/${supplier.id}`)
      toast.success('Поставщик удалён')
      loadSuppliers()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка удаления')
    }
  }

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-mm-cyan uppercase mb-2" data-testid="suppliers-title">Поставщики</h1>
            <p className="text-mm-text-secondary text-sm">// Управление поставщиками</p>
          </div>
          <button
            onClick={() => {
              setEditingSupplier(null)
              setShowModal(true)
            }}
            className="btn-primary flex items-center space-x-2"
            data-testid="create-supplier-btn"
          >
            <FiPlus />
            <span>ДОБАВИТЬ ПОСТАВЩИКА</span>
          </button>
        </div>

        {/* Suppliers Table */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-mm-cyan animate-pulse">// LOADING...</p>
          </div>
        ) : suppliers.length === 0 ? (
          <div className="card-neon text-center py-16" data-testid="empty-state">
            <FiUser className="mx-auto text-mm-text-tertiary mb-6" size={64} />
            <p className="text-mm-text-secondary text-lg mb-2">Нет поставщиков</p>
            <p className="text-sm text-mm-text-tertiary mb-6">// Добавьте первого поставщика</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <FiPlus className="inline mr-2" />
              ДОБАВИТЬ ПОСТАВЩИКА
            </button>
          </div>
        ) : (
          <div className="card-neon overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Название</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Контакт</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Телефон</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">ИНН</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Действия</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors" data-testid={`supplier-row-${s.id}`}>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <FiUser className="text-mm-cyan" size={20} />
                        <div className="font-semibold">{s.name}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-mm-text-secondary">{s.contact_person || '—'}</td>
                    <td className="py-4 px-4 text-sm text-mm-text-secondary font-mono">{s.phone || '—'}</td>
                    <td className="py-4 px-4 text-sm text-mm-text-secondary font-mono">{s.inn || '—'}</td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingSupplier(s)
                          setShowModal(true)
                        }}
                        className="px-3 py-2 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
                        data-testid={`edit-supplier-${s.id}`}
                      >
                        <FiEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="px-3 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors"
                        data-testid={`delete-supplier-${s.id}`}
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <SupplierModal
            supplier={editingSupplier}
            onClose={() => {
              setShowModal(false)
              setEditingSupplier(null)
            }}
            onSuccess={() => {
              setShowModal(false)
              setEditingSupplier(null)
              loadSuppliers()
            }}
          />
        )}
      </div>
    </div>
  )
}

function SupplierModal({ supplier, onClose, onSuccess }) {
  const { api } = useAuth()
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    inn: '',
    address: '',
    comment: ''
  })

  useEffect(() => {
    if (supplier) {
      setFormData({
        name: supplier.name || '',
        contact_person: supplier.contact_person || '',
        phone: supplier.phone || '',
        email: supplier.email || '',
        inn: supplier.inn || '',
        address: supplier.address || '',
        comment: supplier.comment || ''
      })
    }
  }, [supplier])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      if (supplier) {
        await api.put(`/api/suppliers/${supplier.id}`, formData)
        toast.success('Поставщик обновлён')
      } else {
        await api.post('/api/suppliers', formData)
        toast.success('Поставщик создан')
      }
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50" data-testid="supplier-modal">
      <div className="card-neon max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl text-mm-cyan uppercase">
            {supplier ? 'Редактировать поставщика' : 'Добавить поставщика'}
          </h3>
          <button onClick={onClose} className="text-mm-text-secondary hover:text-mm-red transition-colors">
            <FiX size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="input-neon w-full"
              placeholder="ООО Поставщик"
              required
              data-testid="supplier-name-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Контактное лицо</label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                className="input-neon w-full"
                placeholder="Иван Иванов"
                data-testid="contact-person-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Телефон</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                className="input-neon w-full"
                placeholder="+7 (900) 123-45-67"
                data-testid="phone-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="input-neon w-full"
                placeholder="supplier@example.com"
                data-testid="email-input"
              />
            </div>
            <div>
              <label className="block text-sm mb-2 text-mm-text-secondary uppercase">ИНН</label>
              <input
                type="text"
                value={formData.inn}
                onChange={(e) => setFormData({...formData, inn: e.target.value})}
                className="input-neon w-full"
                placeholder="1234567890"
                data-testid="inn-input"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Адрес</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="input-neon w-full"
              placeholder="г. Москва, ул. Поставщиков, 5"
              data-testid="address-input"
            />
          </div>

          <div>
            <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Комментарий</label>
            <textarea
              value={formData.comment}
              onChange={(e) => setFormData({...formData, comment: e.target.value})}
              className="input-neon w-full"
              rows="3"
              placeholder="Дополнительная информация"
              data-testid="comment-input"
            />
          </div>

          <div className="flex space-x-4">
            <button type="button" onClick={onClose} className="btn-secondary flex-1" data-testid="cancel-btn">
              ОТМЕНА
            </button>
            <button type="submit" className="btn-primary flex-1" data-testid="submit-btn">
              {supplier ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuppliersPage
