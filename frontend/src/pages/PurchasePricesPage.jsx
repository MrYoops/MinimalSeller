import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiSave, FiUpload, FiDownload, FiEdit2, FiCheck } from 'react-icons/fi'
import { toast } from 'sonner'

function PurchasePricesPage() {
  const { api } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [changes, setChanges] = useState({})
  const [stats, setStats] = useState({ total: 0, with_price: 0 })
  
  const loadProducts = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/ozon-reports/products-with-prices')
      setProducts(response.data.products)
      setStats({ 
        total: response.data.total, 
        with_price: response.data.with_price 
      })
    } catch (error) {
      toast.error('Ошибка загрузки товаров')
    }
    setLoading(false)
  }
  
  useEffect(() => {
    loadProducts()
  }, [])
  
  const startEdit = (product) => {
    setEditingId(product._id)
    setEditValue(product.purchase_price || '')
  }
  
  const saveEdit = () => {
    const product = products.find(p => p._id === editingId)
    if (product) {
      setChanges({...changes, [product.article]: parseFloat(editValue) || 0})
      setProducts(products.map(p => 
        p._id === editingId 
          ? {...p, purchase_price: parseFloat(editValue) || 0}
          : p
      ))
    }
    setEditingId(null)
    setEditValue('')
  }
  
  const saveAll = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info('Нет изменений для сохранения')
      return
    }
    
    setSaving(true)
    try {
      const response = await api.post('/api/ozon-reports/update-purchase-prices', changes)
      toast.success(`Обновлено ${response.data.updated} товаров`)
      setChanges({})
      await loadProducts()
    } catch (error) {
      toast.error('Ошибка сохранения: ' + (error.response?.data?.detail || error.message))
    }
    setSaving(false)
  }
  
  const exportTemplate = () => {
    const csv = ['article,purchase_price']
    products.forEach(p => {
      csv.push(`${p.article},${p.purchase_price || 0}`)
    })
    
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'purchase_prices.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    toast.success('Шаблон экспортирован')
  }
  
  const fmt = (n) => new Intl.NumberFormat('ru-RU', { 
    style: 'currency', 
    currency: 'RUB' 
  }).format(n || 0)
  
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">ЗАКУПОЧНЫЕ ЦЕНЫ</h2>
        <p className="comment">// Управление себестоимостью товаров (COGS)</p>
      </div>
      
      <div className="card-neon p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="border border-mm-border rounded p-4">
            <div className="text-sm text-mm-text-secondary font-mono mb-1">ВСЕГО ТОВАРОВ</div>
            <div className="text-2xl font-mono text-mm-cyan">{stats.total}</div>
          </div>
          <div className="border border-mm-border rounded p-4">
            <div className="text-sm text-mm-text-secondary font-mono mb-1">С ЦЕНОЙ</div>
            <div className="text-2xl font-mono text-mm-green">{stats.with_price}</div>
          </div>
          <div className="border border-mm-border rounded p-4">
            <div className="text-sm text-mm-text-secondary font-mono mb-1">ПОКРЫТИЕ</div>
            <div className="text-2xl font-mono text-mm-text">
              {stats.total > 0 ? ((stats.with_price / stats.total) * 100).toFixed(1) : 0}%
            </div>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button onClick={saveAll} disabled={saving || Object.keys(changes).length === 0} 
            className="btn-primary">
            <FiSave className="inline mr-2" />
            {saving ? 'СОХРАНЕНИЕ...' : `СОХРАНИТЬ (${Object.keys(changes).length})`}
          </button>
          <button onClick={exportTemplate} className="btn-secondary">
            <FiDownload className="inline mr-2" />ЭКСПОРТ CSV
          </button>
          <label className="btn-secondary cursor-pointer">
            <FiUpload className="inline mr-2" />ИМПОРТ
            <input 
              type="file" 
              accept=".csv,.xlsx,.xls" 
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files[0]
                if (!file) return
                
                const formData = new FormData()
                formData.append('file', file)
                
                try {
                  const response = await api.post(
                    '/api/ozon-reports/import-purchase-prices', 
                    formData,
                    { headers: { 'Content-Type': 'multipart/form-data' } }
                  )
                  toast.success(`Импортировано ${response.data.updated} товаров`)
                  await loadProducts()
                } catch (error) {
                  toast.error('Ошибка импорта')
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// ЗАГРУЗКА...</p>
        </div>
      ) : (
        <div className="card-neon p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Артикул
                  </th>
                  <th className="text-left py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Товар
                  </th>
                  <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Цена продажи
                  </th>
                  <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Закупочная цена
                  </th>
                  <th className="text-right py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Маржа %
                  </th>
                  <th className="text-center py-3 px-4 text-mm-text-secondary uppercase text-sm font-mono">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, idx) => (
                  <tr key={p._id} className="border-b border-mm-border hover:bg-mm-gray hover:bg-opacity-10">
                    <td className="py-3 px-4 font-mono text-sm">{p.article}</td>
                    <td className="py-3 px-4 text-sm">{p.name}</td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {p.price > 0 ? fmt(p.price) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {editingId === p._id ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit()
                            if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                          }}
                          className="w-32 px-2 py-1 bg-mm-black border border-mm-cyan rounded font-mono text-sm text-right"
                          autoFocus
                        />
                      ) : (
                        <span className={`font-mono text-sm ${p.purchase_price > 0 ? 'text-mm-cyan' : 'text-mm-text-tertiary'}`}>
                          {p.purchase_price > 0 ? fmt(p.purchase_price) : 'не указана'}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-sm">
                      {p.margin_pct > 0 ? (
                        <span className={p.margin_pct > 30 ? 'text-mm-green' : p.margin_pct > 15 ? 'text-mm-cyan' : 'text-mm-red'}>
                          {p.margin_pct.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-mm-text-tertiary">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {editingId === p._id ? (
                        <button onClick={saveEdit} className="text-mm-green hover:text-mm-cyan">
                          <FiCheck size={18} />
                        </button>
                      ) : (
                        <button onClick={() => startEdit(p)} className="text-mm-text-secondary hover:text-mm-cyan">
                          <FiEdit2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {products.length === 0 && (
            <div className="text-center py-12 text-mm-text-secondary">
              Нет товаров для отображения
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PurchasePricesPage
