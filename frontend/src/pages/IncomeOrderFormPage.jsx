import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useParams, useNavigate } from 'react-router-dom'
import { FiSave, FiCheckCircle, FiXCircle, FiPlus, FiTrash2, FiSearch } from 'react-icons/fi'
import { toast } from 'sonner'

function IncomeOrderFormPage() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [warehouses, setWarehouses] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  
  const [formData, setFormData] = useState({
    warehouse_id: '',
    supplier_id: '',
    items: []
  })
  
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [order, setOrder] = useState(null)

  useEffect(() => {
    loadData()
    if (id) {
      loadOrder()
    }
  }, [id])

  const loadData = async () => {
    try {
      const [whRes, suppRes, prodRes] = await Promise.all([
        api.get('/api/warehouses'),
        api.get('/api/suppliers'),
        api.get('/api/catalog/products?limit=500')
      ])
      setWarehouses(whRes.data)
      setSuppliers(suppRes.data)
      setProducts(prodRes.data)
    } catch (error) {
      toast.error('Ошибка загрузки данных')
      console.error(error)
    }
  }

  const loadOrder = async () => {
    try {
      const response = await api.get(`/api/income-orders/${id}`)
      setOrder(response.data)
      setFormData({
        warehouse_id: response.data.warehouse_id || '',
        supplier_id: response.data.supplier_id || '',
        items: response.data.items || []
      })
    } catch (error) {
      toast.error('Ошибка загрузки приёмки')
      console.error(error)
    }
  }

  const addProduct = (product) => {
    const existing = formData.items.find(item => item.article === product.article)
    
    if (existing) {
      setFormData({
        ...formData,
        items: formData.items.map(item => 
          item.article === product.article
            ? {...item, quantity: item.quantity + 1}
            : item
        )
      })
    } else {
      setFormData({
        ...formData,
        items: [...formData.items, {
          article: product.article,
          name: product.name,
          quantity: 1,
          purchase_price: 0,
          additional_expenses: 0,
          total: 0
        }]
      })
    }
    
    setSearchQuery('')
  }

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value
    
    if (field === 'quantity' || field === 'purchase_price' || field === 'additional_expenses') {
      const item = newItems[index]
      item.total = (item.purchase_price + item.additional_expenses) * item.quantity
    }
    
    setFormData({...formData, items: newItems})
  }

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    })
  }

  const handleSaveDraft = async () => {
    if (!formData.warehouse_id || !formData.supplier_id) {
      toast.error('Выберите склад и поставщика')
      return
    }

    setLoading(true)
    try {
      if (id) {
        await api.put(`/api/income-orders/${id}`, formData)
        toast.success('Приёмка сохранена')
      } else {
        const response = await api.post('/api/income-orders', formData)
        toast.success('Приёмка создана')
        navigate(`/income-orders/${response.data.order.id}/edit`)
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка сохранения')
    }
    setLoading(false)
  }

  const handleAccept = async () => {
    if (!id) {
      toast.error('Сначала сохраните приёмку')
      return
    }

    if (!confirm('Оприходовать приёмку? Остатки будут изменены!')) return

    setLoading(true)
    try {
      await api.post(`/api/income-orders/${id}/accept`)
      toast.success('Приёмка оприходована! Остатки обновлены.')
      navigate('/income-orders')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка оприходования')
    }
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!confirm('Отменить оприходование? Остатки будут откачены!')) return

    setLoading(true)
    try {
      await api.post(`/api/income-orders/${id}/cancel`)
      toast.success('Оприходование отменено')
      loadOrder()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Ошибка отмены')
    }
    setLoading(false)
  }

  const filteredProducts = products.filter(p =>
    p.article?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totals = formData.items.reduce((acc, item) => ({
    quantity: acc.quantity + (item.quantity || 0),
    amount: acc.amount + (item.total || 0)
  }), { quantity: 0, amount: 0 })

  const isAccepted = order?.status === 'accepted'

  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-mm-cyan uppercase mb-2" data-testid="form-title">
              {id ? `Приёмка #${id.substring(0, 8)}` : 'Новая приёмка'}
            </h1>
            <p className="text-mm-text-secondary text-sm">
              {isAccepted ? '// Оприходовано' : '// Черновик'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {isAccepted ? (
              <span className="px-4 py-2 bg-mm-green/20 text-mm-green border border-mm-green uppercase text-sm font-mono">
                <FiCheck className="inline mr-2" />
                ОПРИХОДОВАНО
              </span>
            ) : (
              <span className="px-4 py-2 bg-mm-yellow/20 text-mm-yellow border border-mm-yellow uppercase text-sm font-mono">
                ЧЕРНОВИК
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-neon" data-testid="warehouse-supplier-section">
            <h3 className="text-mm-cyan uppercase text-sm mb-4">Основная информация</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Склад назначения *</label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
                  className="input-neon w-full"
                  disabled={isAccepted}
                  data-testid="warehouse-select"
                  required
                >
                  <option value="">Выберите склад...</option>
                  {warehouses.map(wh => (
                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Поставщик *</label>
                <select
                  value={formData.supplier_id}
                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}
                  className="input-neon w-full"
                  disabled={isAccepted}
                  data-testid="supplier-select"
                  required
                >
                  <option value="">Выберите поставщика...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card-neon bg-mm-darker" data-testid="totals-section">
            <h3 className="text-mm-cyan uppercase text-sm mb-4">ИТОГО</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-mm-text-secondary">Позиций:</span>
                <span className="text-2xl font-mono font-bold text-mm-text">{formData.items.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-mm-text-secondary">Общее количество:</span>
                <span className="text-2xl font-mono font-bold text-mm-cyan">{totals.quantity}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-mm-border">
                <span className="text-mm-text-secondary">Сумма:</span>
                <span className="text-2xl font-mono font-bold text-mm-green">{(totals.amount / 100).toFixed(2)} ₽</span>
              </div>
            </div>
          </div>
        </div>

        {!isAccepted && (
          <div className="card-neon" data-testid="add-products-section">
            <h3 className="text-mm-cyan uppercase text-sm mb-4">Добавить товары</h3>
            
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-mm-text-tertiary" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-neon w-full pl-10"
                placeholder="Поиск по артикулу или названию..."
                data-testid="product-search-input"
              />
            </div>

            {searchQuery && filteredProducts.length > 0 && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-mm-border bg-mm-darker">
                {filteredProducts.slice(0, 10).map(product => (
                  <button
                    key={product.article}
                    onClick={() => addProduct(product)}
                    className="w-full text-left px-4 py-3 hover:bg-mm-gray transition-colors border-b border-mm-border last:border-b-0"
                    data-testid={`add-product-${product.article}`}
                  >
                    <div className="font-mono text-sm text-mm-cyan">{product.article}</div>
                    <div className="text-sm text-mm-text-secondary">{product.name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {formData.items.length > 0 && (
          <div className="card-neon overflow-hidden" data-testid="items-table">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Артикул</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Название</th>
                  <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Количество</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Цена (руб)</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Расходы (руб)</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Итого (руб)</th>
                  {!isAccepted && <th className="text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Действия</th>}
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, index) => (
                  <tr key={index} className="border-b border-mm-border" data-testid={`item-row-${index}`}>
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">{item.article}</td>
                    <td className="py-4 px-4 text-sm">{item.name}</td>
                    <td className="py-4 px-4">
                      {isAccepted ? (
                        <div className="text-center font-mono font-bold">{item.quantity}</div>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="input-neon w-24 text-center font-mono"
                          data-testid={`quantity-${index}`}
                        />
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {isAccepted ? (
                        <div className="text-right font-mono">{(item.purchase_price / 100).toFixed(2)}</div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(item.purchase_price / 100).toFixed(2)}
                          onChange={(e) => updateItem(index, 'purchase_price', Math.round(parseFloat(e.target.value || 0) * 100))}
                          className="input-neon w-32 text-right font-mono"
                          data-testid={`purchase-price-${index}`}
                        />
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {isAccepted ? (
                        <div className="text-right font-mono">{(item.additional_expenses / 100).toFixed(2)}</div>
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={(item.additional_expenses / 100).toFixed(2)}
                          onChange={(e) => updateItem(index, 'additional_expenses', Math.round(parseFloat(e.target.value || 0) * 100))}
                          className="input-neon w-32 text-right font-mono"
                          data-testid={`expenses-${index}`}
                        />
                      )}
                    </td>
                    <td className="py-4 px-4 text-right font-mono font-bold text-mm-green">
                      {(item.total / 100).toFixed(2)}
                    </td>
                    {!isAccepted && (
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => removeItem(index)}
                          className="px-2 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors"
                          data-testid={`remove-item-${index}`}
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/income-orders')}
            className="btn-secondary"
            data-testid="back-btn"
          >
            ← НАЗАД К СПИСКУ
          </button>

          <div className="flex items-center space-x-3">
            {!isAccepted && (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={loading || !formData.warehouse_id || !formData.supplier_id}
                  className="btn-secondary flex items-center space-x-2 disabled:opacity-50"
                  data-testid="save-draft-btn"
                >
                  <FiSave />
                  <span>СОХРАНИТЬ ЧЕРНОВИК</span>
                </button>

                <button
                  onClick={handleAccept}
                  disabled={loading || !id || formData.items.length === 0}
                  className="btn-primary flex items-center space-x-2 disabled:opacity-50 bg-mm-green border-mm-green hover:bg-mm-green/20"
                  data-testid="accept-btn"
                >
                  <FiCheckCircle />
                  <span>ОПРИХОДОВАТЬ</span>
                </button>
              </>
            )}

            {isAccepted && (
              <button
                onClick={handleCancel}
                disabled={loading}
                className="btn-secondary flex items-center space-x-2 border-mm-red text-mm-red hover:bg-mm-red/10"
                data-testid="cancel-btn"
              >
                <FiXCircle />
                <span>ОТМЕНИТЬ ОПРИХОДОВАНИЕ</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default IncomeOrderFormPage
