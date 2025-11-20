import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiImage, FiEdit, FiEye } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CatalogProductFormV3() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('card') // card, keywords, analytics, prices, mass_edit, hypotheses, suppliers, stock, documents, duplicates
  
  // Categories and data
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  
  // Product data (SelSup style - все цены на уровне товара)
  const [product, setProduct] = useState({
    article: '',
    name: '',
    brand: '',
    category_id: '',
    description: '',
    status: 'active',
    
    // Дополнительные поля как в SelSup
    manufacturer: '',
    country_of_origin: 'Вьетнам',
    label_name: '',
    
    // Цены (на уровне товара, как в SelSup)
    price_with_discount: 0, // Цена со скидкой (в копейках)
    price_without_discount: 0, // Цена без скидки (в копейках)
    price_coefficient: 1, // Поправочный коэффициент
    purchase_price: 0, // Закупочная цена (в копейках)
    additional_expenses: 0, // Доп. расходы (в копейках)
    cost_price: 0, // Себестоимость (авто-расчет, в копейках)
    vat: 0, // НДС (процент)
    
    // Габариты и вес
    weight: 0, // граммы
    dimensions: {
      length: 0, // мм
      width: 0, // мм
      height: 0 // мм
    },
    
    // Дополнительная информация
    gender: '', // МУЖСКОЙ, ЖЕНСКИЙ, МАЛЬЧИКИ, ДЕВОЧКИ
    season: '', // ВЕСНА, ЛЕТО, ОСЕНЬ, ЗИМА, КРУГЛОГОДИЧНЫЙ
    composition: '',
    care_instructions: '',
    additional_info: '',
    website_link: '',
    
    // Настройки группировки
    is_grouped: false,
    group_by_color: false,
    group_by_size: false,
    
    // Характеристики из маркетплейса
    characteristics: {},
    marketplace_category_id: null,
    marketplace: null
  })
  
  const [variants, setVariants] = useState([]) // Цвета
  const [sizes, setSizes] = useState([]) // Размеры для каждого цвета
  const [photos, setPhotos] = useState([])
  const [priceWarnings, setPriceWarnings] = useState([])

  useEffect(() => {
    loadCategories()
    if (id) {
      loadProduct()
      loadVariants()
      loadPhotos()
    }
  }, [id])

  // Авто-расчет себестоимости
  useEffect(() => {
    const costPrice = product.purchase_price + product.additional_expenses
    if (costPrice !== product.cost_price) {
      setProduct(prev => ({ ...prev, cost_price: costPrice }))
    }
  }, [product.purchase_price, product.additional_expenses])

  // Авто-расчет цены со скидкой через коэффициент
  useEffect(() => {
    if (product.price_coefficient && product.price_coefficient !== 1 && product.price_without_discount > 0) {
      const calculatedPrice = Math.round(product.price_without_discount * product.price_coefficient)
      if (calculatedPrice !== product.price_with_discount) {
        setProduct(prev => ({ ...prev, price_with_discount: calculatedPrice }))
      }
    }
  }, [product.price_coefficient, product.price_without_discount])

  // Валидация цен
  useEffect(() => {
    validatePrices()
  }, [product.price_with_discount, product.price_without_discount, product.cost_price])

  const validatePrices = () => {
    const warnings = []
    
    if (product.price_with_discount > 0 && product.price_with_discount < product.cost_price) {
      warnings.push('⚠️ Цена со скидкой ниже себестоимости. Продажа будет убыточной.')
    }
    
    if (product.price_without_discount > 0 && product.price_without_discount < product.cost_price) {
      warnings.push('⚠️ Цена без скидки ниже себестоимости. Продажа будет убыточной.')
    }
    
    setPriceWarnings(warnings)
  }

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/catalog/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadProduct = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/catalog/products/${id}`)
      const data = response.data
      
      // Устанавливаем данные товара
      setProduct({
        ...data,
        dimensions: data.dimensions || { length: 0, width: 0, height: 0 },
        manufacturer: data.manufacturer || '',
        country_of_origin: data.country_of_origin || 'Вьетнам',
        label_name: data.label_name || data.name || '',
        price_with_discount: data.price || 0,
        price_without_discount: data.price_without_discount || data.price || 0,
        price_coefficient: data.price_coefficient || 1,
        purchase_price: data.purchase_price || data.cost_price || 0,
        additional_expenses: data.additional_expenses || 0,
        cost_price: data.cost_price || 0,
        vat: data.vat || 0,
        gender: data.gender || '',
        season: data.season || '',
        composition: data.composition || '',
        care_instructions: data.care_instructions || '',
        additional_info: data.additional_info || '',
        website_link: data.website_link || ''
      })
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
      const productData = {
        ...product,
        // Маппинг для обратной совместимости
        price: product.price_with_discount,
        price_discounted: product.price_with_discount < product.price_without_discount ? product.price_with_discount : null
      }
      
      if (id) {
        await api.put(`/api/catalog/products/${id}`, productData)
        alert('✅ Товар обновлен!')
      } else {
        const response = await api.post('/api/catalog/products', productData)
        alert('✅ Товар создан!')
        navigate(`/catalog/products/${response.data.id}/edit`)
      }
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleProductChange = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }))
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

  const handleAddVariant = async () => {
    const color = prompt('Введите цвет:')
    if (!color) return
    
    const size = prompt('Введите размер:')
    if (!size) return
    
    const sku = `${product.article}-${color.toUpperCase().slice(0,3)}-${size}`
    
    try {
      const response = await api.post(`/api/catalog/products/${id}/variants`, {
        color,
        size,
        sku,
        barcode: ''
      })
      setVariants([...variants, response.data])
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleDeleteVariant = async (variantId) => {
    if (!confirm('Удалить вариацию?')) return
    
    try {
      await api.delete(`/api/catalog/products/${id}/variants/${variantId}`)
      setVariants(variants.filter(v => v.id !== variantId))
    } catch (error) {
      alert('Ошибка: ' + error.message)
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
    <div className="min-h-screen bg-mm-dark pb-12">
      {/* Header */}
      <div className="bg-mm-secondary border-b border-mm-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-mm-text hover:text-mm-cyan transition"
            >
              <FiArrowLeft size={20} />
            </button>
            <h1 className="text-2xl font-bold text-mm-text">
              {id ? `Редактирование товара: ${product.article}` : 'Создание товара'}
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <FiSave /> СОХРАНИТЬ
          </button>
        </div>

        {/* Tabs (только для редактирования) */}
        {id && (
          <div className="flex gap-2 mt-4 border-b border-mm-border">
            <button
              onClick={() => setActiveTab('card')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'card'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              📦 Карточка
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'prices'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              💰 Цены
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 font-medium transition ${
                activeTab === 'analytics'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              📊 Аналитика
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <form onSubmit={handleSubmit}>
          {/* ВКЛАДКА: КАРТОЧКА */}
          {activeTab === 'card' && (
            <div className="grid grid-cols-12 gap-6">
              {/* LEFT COLUMN: PHOTOS */}
              <div className="col-span-3 space-y-4">
                <div className="bg-mm-secondary p-4 rounded-lg">
                  <h3 className="text-sm font-semibold text-mm-text mb-3">ФОТОГРАФИИ</h3>
                  
                  {/* Photos Grid */}
                  <div className="space-y-2">
                    {photos.length === 0 ? (
                      <div className="border-2 border-dashed border-mm-border rounded-lg p-8 text-center">
                        <FiImage className="mx-auto text-4xl text-mm-text-secondary mb-2" />
                        <p className="text-sm text-mm-text-secondary">Нет фотографий</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {photos.map((photo, idx) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.url}
                              alt={`Photo ${idx + 1}`}
                              className="w-full h-24 object-cover rounded bg-mm-dark"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {id && (
                    <button
                      type="button"
                      onClick={handleAddPhoto}
                      className="w-full mt-3 px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded text-sm font-medium"
                    >
                      + Добавить фото
                    </button>
                  )}
                  
                  {!id && (
                    <p className="text-xs text-mm-text-secondary mt-3">
                      💡 Фото можно добавить после создания товара
                    </p>
                  )}
                </div>

                {/* Drag-n-Drop зона (для будущей реализации) */}
                {id && (
                  <div className="border-2 border-dashed border-mm-border rounded-lg p-4 text-center bg-mm-secondary/50">
                    <p className="text-xs text-mm-text-secondary">
                      Перетащите изображения сюда
                    </p>
                  </div>
                )}
              </div>

              {/* RIGHT COLUMN: FORM FIELDS */}
              <div className="col-span-9 space-y-6">
                {/* Предупреждения о ценах */}
                {priceWarnings.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-2">
                    {priceWarnings.map((warning, idx) => (
                      <p key={idx} className="text-yellow-300 text-sm">{warning}</p>
                    ))}
                  </div>
                )}

                {/* БАЗОВЫЕ ПОЛЯ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-lg font-bold text-mm-text border-b border-mm-border pb-2">
                    ОСНОВНАЯ ИНФОРМАЦИЯ
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Категория <span className="text-red-400">*</span>
                      </label>
                      <select
                        value={product.category_id}
                        onChange={(e) => handleProductChange('category_id', e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      >
                        <option value="">Выберите категорию</option>
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Артикул для объединения <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={product.article}
                        onChange={(e) => handleProductChange('article', e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="DD1873200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Название модели <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => handleProductChange('name', e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="DD1873200"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Бренд <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={product.brand}
                        onChange={(e) => handleProductChange('brand', e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Nike"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Производитель
                      </label>
                      <input
                        type="text"
                        value={product.manufacturer}
                        onChange={(e) => handleProductChange('manufacturer', e.target.value)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Производитель"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Страна производства
                      </label>
                      <input
                        type="text"
                        value={product.country_of_origin}
                        onChange={(e) => handleProductChange('country_of_origin', e.target.value)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Вьетнам"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Название для этикетки
                      </label>
                      <input
                        type="text"
                        value={product.label_name}
                        onChange={(e) => handleProductChange('label_name', e.target.value)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Название на этикетке (2 строки)"
                      />
                    </div>
                  </div>
                </div>

                {/* ЦЕНЫ (как в SelSup) */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-lg font-bold text-mm-text border-b border-mm-border pb-2">
                    💰 ЦЕНЫ
                  </h2>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Цена со скидкой ₽ <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.price_with_discount / 100}
                        onChange={(e) => handleProductChange('price_with_discount', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Поправочный коэффициент
                      </label>
                      <input
                        type="number"
                        value={product.price_coefficient}
                        onChange={(e) => handleProductChange('price_coefficient', parseFloat(e.target.value) || 1)}
                        step="0.01"
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Цена без скидки ₽ <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.price_without_discount / 100}
                        onChange={(e) => handleProductChange('price_without_discount', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        НДС %
                      </label>
                      <input
                        type="number"
                        value={product.vat}
                        onChange={(e) => handleProductChange('vat', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Закупочная цена ₽
                      </label>
                      <input
                        type="number"
                        value={product.purchase_price / 100}
                        onChange={(e) => handleProductChange('purchase_price', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Доп. расходы ₽
                      </label>
                      <input
                        type="number"
                        value={product.additional_expenses / 100}
                        onChange={(e) => handleProductChange('additional_expenses', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Себестоимость ₽
                      </label>
                      <input
                        type="number"
                        value={product.cost_price / 100}
                        readOnly
                        className="w-full px-3 py-2 bg-mm-dark/50 border border-mm-border rounded text-mm-text-secondary cursor-not-allowed"
                      />
                      <p className="text-xs text-mm-text-secondary mt-1">Авто-расчет</p>
                    </div>
                  </div>
                </div>

                {/* ОПИСАНИЕ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <div className="flex justify-between items-center border-b border-mm-border pb-2">
                    <h2 className="text-lg font-bold text-mm-text">ОПИСАНИЕ</h2>
                    <span className="text-xs text-mm-text-secondary">
                      {product.description.length} символов
                    </span>
                  </div>

                  <textarea
                    value={product.description}
                    onChange={(e) => handleProductChange('description', e.target.value)}
                    rows="6"
                    className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none resize-none"
                    placeholder="Подробное описание товара..."
                  />
                </div>

                {/* РАЗМЕР И ВЕС С УПАКОВКОЙ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-lg font-bold text-mm-text border-b border-mm-border pb-2">
                    📦 РАЗМЕР И ВЕС С УПАКОВКОЙ
                  </h2>

                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Длина, мм <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.dimensions.length}
                        onChange={(e) => handleProductChange('dimensions', {
                          ...product.dimensions,
                          length: parseInt(e.target.value) || 0
                        })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Ширина, мм <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.dimensions.width}
                        onChange={(e) => handleProductChange('dimensions', {
                          ...product.dimensions,
                          width: parseInt(e.target.value) || 0
                        })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Высота, мм <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.dimensions.height}
                        onChange={(e) => handleProductChange('dimensions', {
                          ...product.dimensions,
                          height: parseInt(e.target.value) || 0
                        })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        Вес, г <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        value={product.weight}
                        onChange={(e) => handleProductChange('weight', parseInt(e.target.value) || 0)}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* ПОЛ И СЕЗОН (кнопки как в SelSup) */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-2">ПОЛ</label>
                    <div className="flex gap-2">
                      {['МУЖСКОЙ', 'МАЛЬЧИКИ', 'ЖЕНСКИЙ', 'ДЕВОЧКИ'].map(gender => (
                        <button
                          key={gender}
                          type="button"
                          onClick={() => handleProductChange('gender', product.gender === gender ? '' : gender)}
                          className={`px-4 py-2 rounded border transition ${
                            product.gender === gender
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark'
                              : 'bg-mm-dark border-mm-border text-mm-text hover:border-mm-cyan'
                          }`}
                        >
                          {gender}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-2">СЕЗОН</label>
                    <div className="flex gap-2 flex-wrap">
                      {['КРУГЛОГОДИЧНЫЙ', 'ЗИМА', 'ЛЕТО', 'ВЕСНА', 'ОСЕНЬ', 'ОСЕНЬ И ВЕСНА'].map(season => (
                        <button
                          key={season}
                          type="button"
                          onClick={() => handleProductChange('season', product.season === season ? '' : season)}
                          className={`px-4 py-2 rounded border transition ${
                            product.season === season
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark'
                              : 'bg-mm-dark border-mm-border text-mm-text hover:border-mm-cyan'
                          }`}
                        >
                          {season}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1">СОСТАВ</label>
                    <input
                      type="text"
                      value={product.composition}
                      onChange={(e) => handleProductChange('composition', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      placeholder="Хлопок 100%"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1">УХОД ЗА ВЕЩАМИ</label>
                    <input
                      type="text"
                      value={product.care_instructions}
                      onChange={(e) => handleProductChange('care_instructions', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      placeholder="Стирка при 30°C"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1">ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ</label>
                    <textarea
                      value={product.additional_info}
                      onChange={(e) => handleProductChange('additional_info', e.target.value)}
                      rows="2"
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none resize-none"
                      placeholder="Внутренний комментарий (не показывается на МП)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1">ССЫЛКА НА САЙТ</label>
                    <input
                      type="url"
                      value={product.website_link}
                      onChange={(e) => handleProductChange('website_link', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      placeholder="https://..."
                    />
                  </div>
                </div>

                {/* ВАРИАЦИИ (ЦВЕТА) */}
                {id && (
                  <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                    <div className="flex justify-between items-center border-b border-mm-border pb-2">
                      <h2 className="text-lg font-bold text-mm-text">ВАРИАЦИИ</h2>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded text-sm font-medium"
                      >
                        + ДОБАВИТЬ
                      </button>
                    </div>

                    {variants.length === 0 ? (
                      <p className="text-mm-text-secondary text-center py-4">
                        Нет вариаций. Добавьте цвет и размер.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {variants.map((variant) => (
                          <div key={variant.id} className="flex items-center gap-3 p-3 bg-mm-dark rounded">
                            <div className="flex-1 grid grid-cols-3 gap-3">
                              <div>
                                <p className="text-xs text-mm-text-secondary">Цвет</p>
                                <p className="text-sm text-mm-text font-medium">{variant.color || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-mm-text-secondary">Размер</p>
                                <p className="text-sm text-mm-text font-medium">{variant.size || '-'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-mm-text-secondary">SKU</p>
                                <p className="text-xs text-mm-text font-mono">{variant.sku}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(variant.id)}
                              className="p-2 text-red-400 hover:bg-red-400/10 rounded transition"
                            >
                              <FiTrash2 />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Статус */}
                <div className="bg-mm-secondary p-6 rounded-lg">
                  <label className="block text-sm text-mm-text-secondary mb-2">СТАТУС</label>
                  <select
                    value={product.status}
                    onChange={(e) => handleProductChange('status', e.target.value)}
                    className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                  >
                    <option value="draft">Черновик</option>
                    <option value="active">Активен</option>
                    <option value="archived">Архив</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: ЦЕНЫ (отдельная страница для управления) */}
          {activeTab === 'prices' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">УПРАВЛЕНИЕ ЦЕНАМИ</h2>
              
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-6">
                  <div className="p-4 bg-mm-dark rounded-lg">
                    <p className="text-xs text-mm-text-secondary mb-1">Цена со скидкой</p>
                    <p className="text-2xl font-bold text-mm-cyan">
                      {(product.price_with_discount / 100).toFixed(2)} ₽
                    </p>
                  </div>
                  <div className="p-4 bg-mm-dark rounded-lg">
                    <p className="text-xs text-mm-text-secondary mb-1">Цена без скидки</p>
                    <p className="text-2xl font-bold text-mm-text">
                      {(product.price_without_discount / 100).toFixed(2)} ₽
                    </p>
                  </div>
                  <div className="p-4 bg-mm-dark rounded-lg">
                    <p className="text-xs text-mm-text-secondary mb-1">Себестоимость</p>
                    <p className="text-2xl font-bold text-mm-text">
                      {(product.cost_price / 100).toFixed(2)} ₽
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-mm-dark rounded-lg">
                    <p className="text-xs text-mm-text-secondary mb-1">Наценка</p>
                    <p className="text-lg font-bold text-green-400">
                      {product.price_with_discount > 0 && product.cost_price > 0
                        ? (((product.price_with_discount - product.cost_price) / product.cost_price) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-mm-dark rounded-lg">
                    <p className="text-xs text-mm-text-secondary mb-1">Маржинальная прибыль</p>
                    <p className="text-lg font-bold text-green-400">
                      {((product.price_with_discount - product.cost_price) / 100).toFixed(2)} ₽
                    </p>
                  </div>
                </div>

                <p className="text-sm text-mm-text-secondary text-center py-4">
                  💡 Более подробное управление ценами будет доступно в отдельном модуле "Цены"
                </p>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: АНАЛИТИКА (заглушка) */}
          {activeTab === 'analytics' && (
            <div className="bg-mm-secondary p-6 rounded-lg text-center py-12">
              <p className="text-mm-text-secondary text-lg">📊 Аналитика по товару</p>
              <p className="text-mm-text-secondary text-sm mt-2">Раздел в разработке</p>
            </div>
          )}
        </form>
      </div>

      {/* Bottom Save Bar (fixed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-mm-secondary border-t border-mm-border p-4 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm text-mm-text-secondary">Отправить в:</span>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-mm-cyan" />
                <span className="text-sm text-mm-text">WB</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-mm-cyan" />
                <span className="text-sm text-mm-text">Ozon</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 accent-mm-cyan" />
                <span className="text-sm text-mm-text">Яндекс</span>
              </label>
            </div>
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <FiSave size={20} /> СОХРАНИТЬ
          </button>
        </div>
      </div>
    </div>
  )
}
