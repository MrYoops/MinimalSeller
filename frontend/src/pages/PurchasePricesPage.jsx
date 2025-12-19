import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiSave, FiUpload, FiDownload, FiEdit2, FiCheck, FiX, FiAlertCircle, FiCheckCircle } from 'react-icons/fi'
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
  
  // Состояние для импорта с выбором столбцов
  const [importMode, setImportMode] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [articleColumn, setArticleColumn] = useState('')
  const [priceColumn, setPriceColumn] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  
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
  
  // Загрузка файла для предпросмотра
  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setSelectedFile(file)
    setImportMode(true)
    setPreviewData(null)
    setArticleColumn('')
    setPriceColumn('')
    setImportResult(null)
    
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const response = await api.post('/api/ozon-reports/preview-price-import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setPreviewData(response.data)
      toast.success(`Файл загружен: ${response.data.total_rows} строк`)
    } catch (error) {
      toast.error('Ошибка загрузки: ' + (error.response?.data?.detail || error.message))
      setImportMode(false)
    }
    e.target.value = ''
  }
  
  // Применение импорта
  const applyImport = async () => {
    if (!articleColumn || !priceColumn) {
      toast.error('Выберите столбцы для артикула и закупочной цены')
      return
    }
    
    if (!selectedFile) {
      toast.error('Файл не выбран')
      return
    }
    
    setImporting(true)
    const formData = new FormData()
    formData.append('file', selectedFile)
    
    try {
      const response = await api.post(
        `/api/ozon-reports/apply-price-import?article_column=${encodeURIComponent(articleColumn)}&price_column=${encodeURIComponent(priceColumn)}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setImportResult(response.data)
      toast.success(`Импорт завершён: обновлено ${response.data.statistics.updated}, создано ${response.data.statistics.created}`)
      await loadProducts()
    } catch (error) {
      toast.error('Ошибка импорта: ' + (error.response?.data?.detail || error.message))
    }
    setImporting(false)
  }
  
  const cancelImport = () => {
    setImportMode(false)
    setPreviewData(null)
    setSelectedFile(null)
    setArticleColumn('')
    setPriceColumn('')
    setImportResult(null)
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
      
      {/* Режим импорта с выбором столбцов */}
      {importMode ? (
        <div className="card-neon p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-mono text-mm-cyan">ИМПОРТ ЗАКУПОЧНЫХ ЦЕН</h3>
            <button onClick={cancelImport} className="text-mm-text-secondary hover:text-mm-red">
              <FiX size={24} />
            </button>
          </div>
          
          {previewData && !importResult && (
            <>
              {/* Информация о файле */}
              <div className="bg-mm-gray/30 rounded p-4">
                <div className="text-sm text-mm-text-secondary mb-2">Файл: <span className="text-mm-text">{previewData.filename}</span></div>
                <div className="text-sm text-mm-text-secondary">Всего строк: <span className="text-mm-cyan font-mono">{previewData.total_rows}</span></div>
              </div>
              
              {/* Выбор столбцов */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-mm-text-secondary text-sm mb-2 font-mono">
                    СТОЛБЕЦ С АРТИКУЛОМ *
                  </label>
                  <select 
                    value={articleColumn}
                    onChange={(e) => setArticleColumn(e.target.value)}
                    className="w-full bg-mm-black border border-mm-border rounded px-4 py-3 text-mm-text focus:border-mm-cyan outline-none"
                    data-testid="article-column-select"
                  >
                    <option value="">-- Выберите столбец --</option>
                    {previewData.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-mm-text-secondary text-sm mb-2 font-mono">
                    СТОЛБЕЦ С ЗАКУПОЧНОЙ ЦЕНОЙ *
                  </label>
                  <select 
                    value={priceColumn}
                    onChange={(e) => setPriceColumn(e.target.value)}
                    className="w-full bg-mm-black border border-mm-border rounded px-4 py-3 text-mm-text focus:border-mm-cyan outline-none"
                    data-testid="price-column-select"
                  >
                    <option value="">-- Выберите столбец --</option>
                    {previewData.columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {/* Предпросмотр таблицы */}
              <div>
                <h4 className="text-mm-text-secondary text-sm mb-3 font-mono">ПРЕДПРОСМОТР (первые 10 строк)</h4>
                <div className="overflow-x-auto border border-mm-border rounded">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-mm-gray/50">
                        {previewData.columns.map(col => (
                          <th 
                            key={col} 
                            className={`text-left py-3 px-4 font-mono text-sm whitespace-nowrap ${
                              col === articleColumn ? 'bg-green-500/20 text-green-400' : 
                              col === priceColumn ? 'bg-blue-500/20 text-blue-400' : 
                              'text-mm-text-secondary'
                            }`}
                          >
                            {col}
                            {col === articleColumn && <span className="ml-2 text-xs">(Артикул)</span>}
                            {col === priceColumn && <span className="ml-2 text-xs">(Цена)</span>}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((row, idx) => (
                        <tr key={idx} className="border-t border-mm-border/50 hover:bg-mm-gray/20">
                          {previewData.columns.map(col => (
                            <td 
                              key={col} 
                              className={`py-2 px-4 text-mm-text whitespace-nowrap ${
                                col === articleColumn ? 'bg-green-500/10' : 
                                col === priceColumn ? 'bg-blue-500/10' : ''
                              }`}
                            >
                              {row[col] || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Кнопки действий */}
              <div className="flex gap-3">
                <button 
                  onClick={applyImport}
                  disabled={importing || !articleColumn || !priceColumn}
                  className="btn-primary flex items-center gap-2"
                  data-testid="apply-import-btn"
                >
                  {importing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-mm-black"></div>
                      ИМПОРТ...
                    </>
                  ) : (
                    <>
                      <FiUpload size={16} />
                      ПРИМЕНИТЬ ИМПОРТ
                    </>
                  )}
                </button>
                <button onClick={cancelImport} className="btn-secondary">
                  ОТМЕНА
                </button>
              </div>
            </>
          )}
          
          {/* Результат импорта */}
          {importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-green-400">
                <FiCheckCircle size={24} />
                <span className="text-lg font-mono">ИМПОРТ ЗАВЕРШЁН</span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-mm-gray/30 rounded p-4 text-center">
                  <div className="text-2xl font-mono text-mm-text">{importResult.statistics.total_rows}</div>
                  <div className="text-sm text-mm-text-secondary">Всего строк</div>
                </div>
                <div className="bg-green-500/10 rounded p-4 text-center">
                  <div className="text-2xl font-mono text-green-400">{importResult.statistics.updated}</div>
                  <div className="text-sm text-mm-text-secondary">Обновлено</div>
                </div>
                <div className="bg-blue-500/10 rounded p-4 text-center">
                  <div className="text-2xl font-mono text-blue-400">{importResult.statistics.created}</div>
                  <div className="text-sm text-mm-text-secondary">Создано</div>
                </div>
                <div className="bg-yellow-500/10 rounded p-4 text-center">
                  <div className="text-2xl font-mono text-yellow-400">{importResult.statistics.skipped}</div>
                  <div className="text-sm text-mm-text-secondary">Пропущено</div>
                </div>
              </div>
              
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded p-4">
                  <div className="flex items-center gap-2 text-red-400 mb-2">
                    <FiAlertCircle size={16} />
                    <span className="font-mono">Ошибки ({importResult.statistics.errors_count}):</span>
                  </div>
                  <div className="text-sm text-mm-text-secondary space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx}>{err}</div>
                    ))}
                  </div>
                </div>
              )}
              
              <button onClick={cancelImport} className="btn-primary">
                ЗАКРЫТЬ
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Статистика и кнопки */}
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
            
            <div className="flex flex-wrap gap-2">
              <button onClick={saveAll} disabled={saving || Object.keys(changes).length === 0} 
                className="btn-primary" data-testid="save-all-btn">
                <FiSave className="inline mr-2" />
                {saving ? 'СОХРАНЕНИЕ...' : `СОХРАНИТЬ (${Object.keys(changes).length})`}
              </button>
              <button onClick={exportTemplate} className="btn-secondary">
                <FiDownload className="inline mr-2" />ЭКСПОРТ CSV
              </button>
              <label className="btn-secondary cursor-pointer" data-testid="import-file-btn">
                <FiUpload className="inline mr-2" />ИМПОРТ ИЗ EXCEL/CSV
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>
          
          {/* Таблица товаров */}
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
                    {products.map((p) => (
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
        </>
      )}
    </div>
  )
}

export default PurchasePricesPage
