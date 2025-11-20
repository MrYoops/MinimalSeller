import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiPackage, FiDownload } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CatalogProductFormPageV2() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 1: основная инфо, 2: категория и характеристики
  const [categories, setCategories] = useState([])
  const [marketplaceCategories, setMarketplaceCategories] = useState([])
  const [selectedMarketplace, setSelectedMarketplace] = useState('wb')
  const [selectedMpCategory, setSelectedMpCategory] = useState(null)
  const [categoryAttributes, setCategoryAttributes] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loadingAttributes, setLoadingAttributes] = useState(false)
  
  const [product, setProduct] = useState({
    article: '',
    name: '',
    brand: '',
    category_id: '',
    description: '',
    status: 'draft',
    is_grouped: false,
    group_by_color: false,
    group_by_size: false
  })
  
  const [attributes, setAttributes] = useState({})
  const [variants, setVariants] = useState([])
  const [prices, setPrices] = useState([])
  const [photos, setPhotos] = useState([])

  useEffect(() => {
    loadCategories()
    if (id) {
      loadProduct()
      loadVariants()
      loadPrices()
      loadPhotos()
    }
  }, [id])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/catalog/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadMarketplaceCategories = async () => {
    if (!selectedMarketplace) return
    
    setLoadingCategories(true)
    try {
      const response = await api.get(`/api/marketplaces/${selectedMarketplace}/categories`)
      setMarketplaceCategories(response.data.categories || [])
    } catch (error) {
      alert('Ошибка загрузки категорий: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoadingCategories(false)
    }
  }

  const loadCategoryAttributes = async (categoryId, typeId) => {
    setLoadingAttributes(true)
    try {
      const params = selectedMarketplace === 'ozon' ? { type_id: typeId } : {}
      const response = await api.get(
        `/api/marketplaces/${selectedMarketplace}/categories/${categoryId}/attributes`,
        { params }
      )
      setCategoryAttributes(response.data.attributes || [])
    } catch (error) {
      alert('Ошибка загрузки характеристик: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoadingAttributes(false)
    }
  }

  const loadProduct = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/catalog/products/${id}`)
      setProduct(response.data)
    } catch (error) {
      alert('Ошибка загрузки товара: ' + error.message)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadVariants = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${id}/variants`)
      setVariants(response.data)
    } catch (error) {
      console.error('Failed to load variants:', error)
    }
  }

  const loadPrices = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${id}/prices`)
      setPrices(response.data)
    } catch (error) {
      console.error('Failed to load prices:', error)
    }
  }

  const loadPhotos = async () => {
    try {
      const response = await api.get(`/api/catalog/products/${id}/photos`)
      setPhotos(response.data)
    } catch (error) {
      console.error('Failed to load photos:', error)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      if (id) {
        await api.put(`/api/catalog/products/${id}`, product)
        alert('Товар обновлен!')
      } else {
        const response = await api.post('/api/catalog/products', product)
        alert('Товар создан!')
        navigate(`/catalog/products/${response.data.id}/edit`)
      }
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleAddVariant = async () => {
    const color = prompt('Введите цвет (или вкус/принт):')
    if (!color) return
    
    const size = prompt('Введите размер (или параметр):')
    if (!size) return
    
    const sku = `${product.article}-${color.toUpperCase().slice(0,3)}-${size}`
    
    try {
      const response = await api.post(`/api/catalog/products/${id}/variants`, {
        color,
        size,
        sku
      })
      setVariants([...variants, response.data])
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const handleDeleteVariant = async (variantId) => {
    if (!confirm('Удалить вариацию? Это также удалит связанные фото, цены и остатки.')) return
    
    try {
      await api.delete(`/api/catalog/products/${id}/variants/${variantId}`)
      setVariants(variants.filter(v => v.id !== variantId))
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleAddPhoto = async () => {
    const url = prompt('Введите URL фото:')
    if (!url) return
    
    try {
      const response = await api.post(`/api/catalog/products/${id}/photos`, {
        url,
        order: photos.length + 1,
        marketplaces: { wb: true, ozon: true, yandex: true }
      })
      setPhotos([...photos, response.data])
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleDeletePhoto = async (photoId) => {
    try {
      await api.delete(`/api/catalog/products/${id}/photos/${photoId}`)
      setPhotos(photos.filter(p => p.id !== photoId))
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleSetPrice = async (variantId, field, value) => {
    try {
      const existingPrice = prices.find(p => p.variant_id === variantId)
      
      const priceData = existingPrice ? {
        ...existingPrice,
        [field]: parseFloat(value) || 0
      } : {
        variant_id: variantId,
        purchase_price: 0,
        retail_price: 0,
        price_without_discount: 0,
        marketplace_prices: { wb: 0, ozon: 0, yandex: 0 },
        [field]: parseFloat(value) || 0
      }
      
      await api.post(`/api/catalog/products/${id}/prices`, priceData)
      loadPrices()
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handlePublishToMarketplace = async (marketplace) => {
    if (!confirm(`Отправить товар на ${marketplace.toUpperCase()}?`)) return
    
    try {
      const response = await api.post(`/api/catalog/products/${id}/publish/${marketplace}`)
      alert(`✅ ${response.data.message}\n\nФото: ${response.data.details.photos_count}\nХарактеристик: ${response.data.details.characteristics_count}\n\n${response.data.details.status}`)
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  if (loading && id) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan"></div>
        <p className="text-mm-text-secondary mt-4">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-mm-cyan hover:underline mb-2 flex items-center gap-2"
          >
            <FiArrowLeft /> Назад к товарам
          </button>
          <h1 className="text-3xl font-bold text-mm-cyan">
            {id ? 'РЕДАКТИРОВАНИЕ ТОВАРА' : 'СОЗДАНИЕ КАРТОЧКИ ТОВАРА'}
          </h1>
          <p className="text-sm text-mm-text-secondary mt-1">
            {id ? 'Изменение данных товара' : 'Шаг за шагом создайте карточку как в SelsUp'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Кнопки маркетплейсов (только при редактировании) */}
          {id && (
            <>
              <button
                onClick={() => handlePublishToMarketplace('wb')}
                className="px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded flex items-center gap-2"
                title="Отправить на Wildberries"
              >
                🟣 WB
              </button>
              <button
                onClick={() => handlePublishToMarketplace('ozon')}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded flex items-center gap-2"
                title="Отправить на Ozon"
              >
                🔵 OZON
              </button>
              <button
                onClick={() => handlePublishToMarketplace('yandex')}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded flex items-center gap-2"
                title="Отправить на Яндекс.Маркет"
              >
                🔴 YM
              </button>
            </>
          )}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2 disabled:opacity-50"
          >
            <FiSave /> СОХРАНИТЬ
          </button>
        </div>
      </div>

      {/* Steps for new product */}
      {!id && (
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-mm-cyan' : 'text-mm-text-secondary'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 1 ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark'
            }`}>1</div>
            <span className="text-sm">Основная информация</span>
          </div>
          <div className="flex-1 h-px bg-mm-border"></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-mm-cyan' : 'text-mm-text-secondary'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step >= 2 ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark'
            }`}>2</div>
            <span className="text-sm">Категория и характеристики</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Шаг 1 или Редактирование: Основная информация */}
        {(step === 1 || id) && (
          <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-bold text-mm-text mb-4 border-b border-mm-border pb-2">
              ОСНОВНАЯ ИНФОРМАЦИЯ
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-mm-text-secondary mb-1">
                  Артикул <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={product.article}
                  onChange={(e) => setProduct({ ...product, article: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                  placeholder="ART-001"
                />
                <p className="text-xs text-mm-text-secondary mt-1">Уникальный артикул товара</p>
              </div>

              <div>
                <label className="block text-sm text-mm-text-secondary mb-1">
                  Название <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={product.name}
                  onChange={(e) => setProduct({ ...product, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                  placeholder="Футболка базовая"
                />
              </div>

              <div>
                <label className="block text-sm text-mm-text-secondary mb-1">Бренд</label>
                <input
                  type="text"
                  value={product.brand}
                  onChange={(e) => setProduct({ ...product, brand: e.target.value })}
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                  placeholder="MyBrand"
                />
              </div>

              <div>
                <label className="block text-sm text-mm-text-secondary mb-1">Категория (ваша)</label>
                <select
                  value={product.category_id}
                  onChange={(e) => setProduct({ ...product, category_id: e.target.value })}
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                >
                  <option value="">Выберите категорию</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <p className="text-xs text-mm-text-secondary mt-1">Опционально: для группировки ваших товаров</p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-mm-text-secondary mb-1">Описание</label>
              <textarea
                value={product.description}
                onChange={(e) => setProduct({ ...product, description: e.target.value })}
                rows="3"
                className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                placeholder="Подробное описание товара"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-mm-text-secondary mb-1">Статус</label>
                <select
                  value={product.status}
                  onChange={(e) => setProduct({ ...product, status: e.target.value })}
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                >
                  <option value="draft">Черновик</option>
                  <option value="active">Активен</option>
                  <option value="archived">Архив</option>
                </select>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={product.group_by_color}
                    onChange={(e) => setProduct({ ...product, group_by_color: e.target.checked, is_grouped: e.target.checked || product.group_by_size })}
                    className="w-5 h-5 accent-mm-cyan"
                  />
                  <span className="text-mm-text">Разделять по цвету</span>
                </label>
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={product.group_by_size}
                    onChange={(e) => setProduct({ ...product, group_by_size: e.target.checked, is_grouped: product.group_by_color || e.target.checked })}
                    className="w-5 h-5 accent-mm-cyan"
                  />
                  <span className="text-mm-text">Разделять по размеру</span>
                </label>
              </div>
            </div>

            {!id && (
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
                >
                  Далее: Выбор категории МП →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Шаг 2: Категория маркетплейса и характеристики */}
        {step === 2 && !id && (
          <div className="bg-mm-secondary p-6 rounded-lg space-y-6">
            <div className="flex justify-between items-center border-b border-mm-border pb-2">
              <h2 className="text-xl font-bold text-mm-text">КАТЕГОРИЯ МАРКЕТПЛЕЙСА</h2>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-mm-cyan hover:underline text-sm"
              >
                ← Назад
              </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
              <p className="text-blue-300 text-sm">
                💡 <strong>Как в SelsUp:</strong> Выберите маркетплейс и категорию товара. 
                Система автоматически загрузит все обязательные характеристики для этой категории.
              </p>
            </div>

            {/* Выбор маркетплейса */}
            <div>
              <label className="block text-sm text-mm-text-secondary mb-2">
                Выберите маркетплейс <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['ozon', 'wb', 'yandex'].map((mp) => {
                  const names = { ozon: 'Ozon', wb: 'Wildberries', yandex: 'Яндекс.Маркет' }
                  const colors = { ozon: 'blue', wb: 'purple', yandex: 'red' }
                  const bgClasses = {
                    ozon: selectedMarketplace === 'ozon' ? 'border-blue-500 bg-blue-500/10' : 'border-mm-border hover:border-blue-500/50',
                    wb: selectedMarketplace === 'wb' ? 'border-purple-500 bg-purple-500/10' : 'border-mm-border hover:border-purple-500/50',
                    yandex: selectedMarketplace === 'yandex' ? 'border-red-500 bg-red-500/10' : 'border-mm-border hover:border-red-500/50'
                  }
                  return (
                    <button
                      key={mp}
                      type="button"
                      onClick={() => {
                        setSelectedMarketplace(mp)
                        setMarketplaceCategories([])
                        setSelectedMpCategory(null)
                        setCategoryAttributes([])
                      }}
                      className={`p-4 rounded-lg cursor-pointer transition border-2 text-center ${bgClasses[mp]}`}
                    >
                      <h3 className="text-lg font-bold text-mm-text">{names[mp]}</h3>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Кнопка загрузки категорий */}
            {selectedMarketplace && marketplaceCategories.length === 0 && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={loadMarketplaceCategories}
                  disabled={loadingCategories}
                  className="px-6 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2 mx-auto disabled:opacity-50"
                >
                  {loadingCategories ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-mm-dark"></div>
                      Загрузка категорий...
                    </>
                  ) : (
                    <>
                      <FiDownload /> Загрузить категории с {selectedMarketplace.toUpperCase()}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Список категорий */}
            {marketplaceCategories.length > 0 && (
              <div>
                <label className="block text-sm text-mm-text-secondary mb-2">
                  Выберите категорию товара <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedMpCategory?.id || ''}
                  onChange={(e) => {
                    const cat = marketplaceCategories.find(c => c.id === e.target.value)
                    setSelectedMpCategory(cat)
                    if (cat && selectedMarketplace === 'wb') {
                      loadCategoryAttributes(cat.id, 0)
                    }
                  }}
                  className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                >
                  <option value="">-- Выберите категорию --</option>
                  {marketplaceCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-mm-text-secondary mt-1">
                  Найдено категорий: {marketplaceCategories.length}
                </p>
              </div>
            )}

            {/* Характеристики категории */}
            {selectedMpCategory && categoryAttributes.length > 0 && (
              <div className="bg-mm-dark p-4 rounded-lg">
                <h3 className="text-lg font-bold text-mm-text mb-3">
                  Характеристики для "{selectedMpCategory.name}"
                </h3>
                <p className="text-xs text-mm-text-secondary mb-4">
                  Загружено характеристик: {categoryAttributes.length}
                </p>
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {categoryAttributes.slice(0, 10).map((attr, idx) => (
                    <div key={idx} className="text-xs">
                      <span className="text-mm-cyan">{attr.name || attr.title || 'Unnamed'}</span>
                      {attr.required && <span className="text-red-400 ml-2">*</span>}
                      {attr.description && (
                        <p className="text-mm-text-secondary mt-1">{attr.description}</p>
                      )}
                    </div>
                  ))}
                  {categoryAttributes.length > 10 && (
                    <p className="text-xs text-mm-text-secondary">
                      ... и ещё {categoryAttributes.length - 10} характеристик
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Вариации (только если товар уже создан) */}
        {id && (product.is_grouped || product.group_by_color || product.group_by_size) && (
          <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center border-b border-mm-border pb-2">
              <h2 className="text-xl font-bold text-mm-text">ВАРИАЦИИ (ЦВЕТ + РАЗМЕР)</h2>
              <button
                type="button"
                onClick={handleAddVariant}
                className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
              >
                <FiPlus /> Добавить вариацию
              </button>
            </div>

            {variants.length === 0 ? (
              <p className="text-mm-text-secondary text-center py-4">Нет вариаций. Добавьте цвет и размер.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-mm-dark">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Цвет</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Размер</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">SKU</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Закупочная ₽</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Розничная ₽</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">WB ₽</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Ozon ₽</th>
                      <th className="px-3 py-2 text-left text-xs text-mm-text-secondary">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-mm-border">
                    {variants.map((variant) => {
                      const variantPrice = prices.find(p => p.variant_id === variant.id)
                      return (
                        <tr key={variant.id}>
                          <td className="px-3 py-2 text-sm text-mm-text">{variant.color || '-'}</td>
                          <td className="px-3 py-2 text-sm text-mm-text">{variant.size || '-'}</td>
                          <td className="px-3 py-2 text-sm text-mm-text font-mono text-xs">{variant.sku}</td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={variantPrice?.purchase_price || 0}
                              onChange={(e) => handleSetPrice(variant.id, 'purchase_price', e.target.value)}
                              className="w-20 px-2 py-1 text-sm bg-mm-dark border border-mm-border rounded text-mm-text"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={variantPrice?.retail_price || 0}
                              onChange={(e) => handleSetPrice(variant.id, 'retail_price', e.target.value)}
                              className="w-20 px-2 py-1 text-sm bg-mm-dark border border-mm-border rounded text-mm-text"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={variantPrice?.marketplace_prices?.wb || 0}
                              onChange={(e) => {
                                const newPrice = { ...variantPrice, marketplace_prices: { ...variantPrice?.marketplace_prices, wb: parseFloat(e.target.value) || 0 }}
                                handleSetPrice(variant.id, 'marketplace_prices', newPrice.marketplace_prices)
                              }}
                              className="w-20 px-2 py-1 text-sm bg-mm-dark border border-mm-border rounded text-mm-text"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={variantPrice?.marketplace_prices?.ozon || 0}
                              onChange={(e) => {
                                const newPrice = { ...variantPrice, marketplace_prices: { ...variantPrice?.marketplace_prices, ozon: parseFloat(e.target.value) || 0 }}
                                handleSetPrice(variant.id, 'marketplace_prices', newPrice.marketplace_prices)
                              }}
                              className="w-20 px-2 py-1 text-sm bg-mm-dark border border-mm-border rounded text-mm-text"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(variant.id)}
                              className="p-1 text-red-400 hover:bg-red-400/10 rounded"
                            >
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Фото (только если товар уже создан) */}
        {id && (
          <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
            <div className="flex justify-between items-center border-b border-mm-border pb-2">
              <h2 className="text-xl font-bold text-mm-text">ФОТОГРАФИИ</h2>
              <button
                type="button"
                onClick={handleAddPhoto}
                className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
              >
                <FiPlus /> Добавить фото
              </button>
            </div>

            {photos.length === 0 ? (
              <p className="text-mm-text-secondary text-center py-4">Нет фотографий. Добавьте фото товара.</p>
            ) : (
              <div className="grid grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photo.url}
                      alt="Product"
                      className="w-full h-48 object-cover rounded bg-mm-dark"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition"
                    >
                      <FiTrash2 size={16} />
                    </button>
                    <div className="mt-2 flex gap-2 text-xs">
                      <span className={photo.marketplaces?.wb ? 'text-purple-400' : 'text-gray-600'}>WB</span>
                      <span className={photo.marketplaces?.ozon ? 'text-blue-400' : 'text-gray-600'}>Ozon</span>
                      <span className={photo.marketplaces?.yandex ? 'text-red-400' : 'text-gray-600'}>YM</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Характеристики товара (только если товар уже создан) */}
        {id && product.characteristics && Object.keys(product.characteristics).length > 0 && (
          <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
            <h2 className="text-xl font-bold text-mm-text border-b border-mm-border pb-2">
              ХАРАКТЕРИСТИКИ ТОВАРА
            </h2>
            <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mb-4">
              <p className="text-xs text-blue-300">
                💡 Характеристики импортированы с маркетплейса. Всего: {Object.keys(product.characteristics).length}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(product.characteristics).map(([key, value]) => (
                <div key={key} className="bg-mm-dark p-3 rounded">
                  <div className="text-xs text-mm-text-secondary mb-1">{key}</div>
                  <div className="text-sm text-mm-text font-medium">
                    {Array.isArray(value) ? value.join(', ') : value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Информация */}
        {!id && step === 1 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
            <p className="text-blue-300 text-sm">
              💡 После заполнения основной информации вы сможете выбрать категорию маркетплейса и посмотреть все обязательные характеристики.
            </p>
          </div>
        )}
      </form>
    </div>
  )
}
