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
    
    // Auto-calculate total
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
    <div className=\"min-h-screen bg-mm-black text-mm-text p-6\">
      <div className=\"max-w-7xl mx-auto space-y-6\">
        {/* Header */}
        <div className=\"flex items-center justify-between\">
          <div>
            <h1 className=\"text-3xl font-bold text-mm-cyan uppercase mb-2\" data-testid=\"form-title\">
              {id ? `Приёмка #${id.substring(0, 8)}` : 'Новая приёмка'}
            </h1>
            <p className=\"text-mm-text-secondary text-sm\">// {isAccepted ? 'Оприходовано' : 'Черновик'}</p>
          </div>
          <div className=\"flex items-center space-x-2\">
            {isAccepted ? (
              <span className=\"px-4 py-2 bg-mm-green/20 text-mm-green border border-mm-green uppercase text-sm font-mono\">\n                <FiCheck className=\"inline mr-2\" />\n                ОПРИХОДОВАНО\n              </span>
            ) : (
              <span className=\"px-4 py-2 bg-mm-yellow/20 text-mm-yellow border border-mm-yellow uppercase text-sm font-mono\">\n                ЧЕРНОВИК\n              </span>
            )}\n          </div>\n        </div>\n\n        {/* Main Form */}\n        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-6\">\n          {/* Warehouse & Supplier */}\n          <div className=\"card-neon\" data-testid=\"warehouse-supplier-section\">\n            <h3 className=\"text-mm-cyan uppercase text-sm mb-4\">// Основная информация</h3>\n            \n            <div className=\"space-y-4\">\n              <div>\n                <label className=\"block text-sm mb-2 text-mm-text-secondary uppercase\">Склад назначения *</label>\n                <select\n                  value={formData.warehouse_id}\n                  onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}\n                  className=\"input-neon w-full\"\n                  disabled={isAccepted}\n                  data-testid=\"warehouse-select\"\n                  required\n                >\n                  <option value=\"\">Выберите склад...</option>\n                  {warehouses.map(wh => (\n                    <option key={wh.id} value={wh.id}>{wh.name}</option>\n                  ))}\n                </select>\n              </div>\n\n              <div>\n                <label className=\"block text-sm mb-2 text-mm-text-secondary uppercase\">Поставщик *</label>\n                <select\n                  value={formData.supplier_id}\n                  onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}\n                  className=\"input-neon w-full\"\n                  disabled={isAccepted}\n                  data-testid=\"supplier-select\"\n                  required\n                >\n                  <option value=\"\">Выберите поставщика...</option>\n                  {suppliers.map(s => (\n                    <option key={s.id} value={s.id}>{s.name}</option>\n                  ))}\n                </select>\n              </div>\n            </div>\n          </div>\n\n          {/* Totals */}\n          <div className=\"card-neon bg-mm-darker\" data-testid=\"totals-section\">\n            <h3 className=\"text-mm-cyan uppercase text-sm mb-4\">// Итого</h3>\n            \n            <div className=\"space-y-3\">\n              <div className=\"flex justify-between items-center\">\n                <span className=\"text-mm-text-secondary\">Позиций:</span>\n                <span className=\"text-2xl font-mono font-bold text-mm-text\">{formData.items.length}</span>\n              </div>\n              <div className=\"flex justify-between items-center\">\n                <span className=\"text-mm-text-secondary\">Общее количество:</span>\n                <span className=\"text-2xl font-mono font-bold text-mm-cyan\">{totals.quantity}</span>\n              </div>\n              <div className=\"flex justify-between items-center pt-3 border-t border-mm-border\">\n                <span className=\"text-mm-text-secondary\">Сумма:</span>\n                <span className=\"text-2xl font-mono font-bold text-mm-green\">{(totals.amount / 100).toFixed(2)} ₽</span>\n              </div>\n            </div>\n          </div>\n        </div>\n\n        {/* Add Products */}\n        {!isAccepted && (\n          <div className=\"card-neon\" data-testid=\"add-products-section\">\n            <h3 className=\"text-mm-cyan uppercase text-sm mb-4\">// Добавить товары</h3>\n            \n            <div className=\"relative\">\n              <FiSearch className=\"absolute left-3 top-1/2 -translate-y-1/2 text-mm-text-tertiary\" />\n              <input\n                type=\"text\"\n                value={searchQuery}\n                onChange={(e) => setSearchQuery(e.target.value)}\n                className=\"input-neon w-full pl-10\"\n                placeholder=\"Поиск по артикулу или названию...\"\n                data-testid=\"product-search-input\"\n              />\n            </div>\n\n            {searchQuery && filteredProducts.length > 0 && (\n              <div className=\"mt-2 max-h-60 overflow-y-auto border border-mm-border bg-mm-darker\">\n                {filteredProducts.slice(0, 10).map(product => (\n                  <button\n                    key={product.article}\n                    onClick={() => addProduct(product)}\n                    className=\"w-full text-left px-4 py-3 hover:bg-mm-gray transition-colors border-b border-mm-border last:border-b-0\"\n                    data-testid={`add-product-${product.article}`}\n                  >\n                    <div className=\"font-mono text-sm text-mm-cyan\">{product.article}</div>\n                    <div className=\"text-sm text-mm-text-secondary\">{product.name}</div>\n                  </button>\n                ))}\n              </div>\n            )}\n          </div>\n        )}\n\n        {/* Items Table */}\n        {formData.items.length > 0 && (\n          <div className=\"card-neon overflow-hidden\" data-testid=\"items-table\">\n            <table className=\"w-full\">\n              <thead>\n                <tr className=\"border-b border-mm-border\">\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Артикул</th>\n                  <th className=\"text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Название</th>\n                  <th className=\"text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Кол-во</th>\n                  <th className=\"text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Цена закупки (₽)</th>\n                  <th className=\"text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Доп. расходы (₽)</th>\n                  <th className=\"text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Итого (₽)</th>\n                  {!isAccepted && <th className=\"text-center py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono\">Действия</th>}\n                </tr>\n              </thead>\n              <tbody>\n                {formData.items.map((item, index) => (\n                  <tr key={index} className=\"border-b border-mm-border\" data-testid={`item-row-${index}`}>\n                    <td className=\"py-4 px-4 font-mono text-sm text-mm-cyan\">{item.article}</td>\n                    <td className=\"py-4 px-4 text-sm\">{item.name}</td>\n                    <td className=\"py-4 px-4\">\n                      {isAccepted ? (\n                        <div className=\"text-center font-mono font-bold\">{item.quantity}</div>\n                      ) : (\n                        <input\n                          type=\"number\"\n                          min=\"1\"\n                          value={item.quantity}\n                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}\n                          className=\"input-neon w-24 text-center font-mono\"\n                          data-testid={`quantity-${index}`}\n                        />\n                      )}\n                    </td>\n                    <td className=\"py-4 px-4\">\n                      {isAccepted ? (\n                        <div className=\"text-right font-mono\">{(item.purchase_price / 100).toFixed(2)}</div>\n                      ) : (\n                        <input\n                          type=\"number\"\n                          min=\"0\"\n                          step=\"0.01\"\n                          value={(item.purchase_price / 100).toFixed(2)}\n                          onChange={(e) => updateItem(index, 'purchase_price', Math.round(parseFloat(e.target.value || 0) * 100))}\n                          className=\"input-neon w-32 text-right font-mono\"\n                          data-testid={`purchase-price-${index}`}\n                        />\n                      )}\n                    </td>\n                    <td className=\"py-4 px-4\">\n                      {isAccepted ? (\n                        <div className=\"text-right font-mono\">{(item.additional_expenses / 100).toFixed(2)}</div>\n                      ) : (\n                        <input\n                          type=\"number\"\n                          min=\"0\"\n                          step=\"0.01\"\n                          value={(item.additional_expenses / 100).toFixed(2)}\n                          onChange={(e) => updateItem(index, 'additional_expenses', Math.round(parseFloat(e.target.value || 0) * 100))}\n                          className=\"input-neon w-32 text-right font-mono\"\n                          data-testid={`expenses-${index}`}\n                        />\n                      )}\n                    </td>\n                    <td className=\"py-4 px-4 text-right font-mono font-bold text-mm-green\">\n                      {(item.total / 100).toFixed(2)}\n                    </td>\n                    {!isAccepted && (\n                      <td className=\"py-4 px-4 text-center\">\n                        <button\n                          onClick={() => removeItem(index)}\n                          className=\"px-2 py-2 border border-mm-red text-mm-red hover:bg-mm-red/10 transition-colors\"\n                          data-testid={`remove-item-${index}`}\n                        >\n                          <FiTrash2 size={16} />\n                        </button>\n                      </td>\n                    )}\n                  </tr>\n                ))}\n              </tbody>\n            </table>\n          </div>\n        )}\n\n        {/* Actions */}\n        <div className=\"flex items-center justify-between\">\n          <button\n            onClick={() => navigate('/income-orders')}\n            className=\"btn-secondary\"\n            data-testid=\"back-btn\"\n          >\n            ← НАЗАД К СПИСКУ\n          </button>\n\n          <div className=\"flex items-center space-x-3\">\n            {!isAccepted && (\n              <>\n                <button\n                  onClick={handleSaveDraft}\n                  disabled={loading || !formData.warehouse_id || !formData.supplier_id}\n                  className=\"btn-secondary flex items-center space-x-2 disabled:opacity-50\"\n                  data-testid=\"save-draft-btn\"\n                >\n                  <FiSave />\n                  <span>СОХРАНИТЬ ЧЕРНОВИК</span>\n                </button>\n\n                <button\n                  onClick={handleAccept}\n                  disabled={loading || !id || formData.items.length === 0}\n                  className=\"btn-primary flex items-center space-x-2 disabled:opacity-50 bg-mm-green border-mm-green hover:bg-mm-green/20\"\n                  data-testid=\"accept-btn\"\n                >\n                  <FiCheckCircle />\n                  <span>ОПРИХОДОВАТЬ</span>\n                </button>\n              </>\n            )}\n\n            {isAccepted && (\n              <button\n                onClick={handleCancel}\n                disabled={loading}\n                className=\"btn-secondary flex items-center space-x-2 border-mm-red text-mm-red hover:bg-mm-red/10\"\n                data-testid=\"cancel-btn\"\n              >\n                <FiXCircle />\n                <span>ОТМЕНИТЬ ОПРИХОДОВАНИЕ</span>\n              </button>\n            )}\n          </div>\n        </div>\n      </div>\n    </div>\n  )\n}\n\nexport default IncomeOrderFormPage\n