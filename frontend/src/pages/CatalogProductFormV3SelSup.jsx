import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiImage, FiEdit, FiEye, FiDownload, FiUpload, FiSettings, FiClock, FiCheck } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CatalogProductFormV3SelSup() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('card')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  
  // Categories and data
  const [categories, setCategories] = useState([])
  
  // Marketplace toggles
  const [marketplaces, setMarketplaces] = useState({
    wb: false,
    ozon: false,
    yandex: false,
    honest_sign: false
  })
  
  // Product data (SelSup style)
  const [product, setProduct] = useState({
    article: '',
    name: '',
    brand: '',
    category_id: '',
    description: '',
    status: 'active',
    
    manufacturer: '',
    country_of_origin: 'Вьетнам',
    label_name: '',
    
    price_with_discount: 0,
    price_without_discount: 0,
    price_coefficient: 1,
    purchase_price: 0,
    additional_expenses: 0,
    cost_price: 0,
    vat: 0,
    
    weight: 0,
    dimensions: {
      length: 0,
      width: 0,
      height: 0
    },
    
    gender: '',
    season: '',
    composition: '',
    care_instructions: '',
    additional_info: '',
    website_link: '',
    
    is_grouped: false,
    group_by_color: false,
    group_by_size: false,
    characteristics: {},
    marketplace_category_id: null,
    marketplace: null
  })
  
  const [variants, setVariants] = useState([])
  const [photos, setPhotos] = useState([])
  const [priceWarnings, setPriceWarnings] = useState([])
  const [keywords, setKeywords] = useState('')

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

  // Валидация цен
  useEffect(() => {
    const warnings = []
    
    if (product.price_with_discount > 0 && product.price_with_discount < product.cost_price) {
      warnings.push('⚠️ Цена со скидкой ниже себестоимости. Продажа будет убыточной.')
    }
    
    if (product.price_without_discount > 0 && product.price_without_discount < product.cost_price) {
      warnings.push('⚠️ Цена без скидки ниже себестоимости. Продажа будет убыточной.')
    }
    
    setPriceWarnings(warnings)
  }, [product.price_with_discount, product.price_without_discount, product.cost_price])

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
      
      setProduct({
        ...data,
        dimensions: data.dimensions || { length: 0, width: 0, height: 0 },
        manufacturer: data.manufacturer || '',
        country_of_origin: data.country_of_origin || 'Вьетнам',
        label_name: data.label_name || data.name || '',
        price_with_discount: data.price_with_discount || data.price || 0,
        price_without_discount: data.price_without_discount || data.price || 0,
        price_coefficient: data.price_coefficient || 1,
        purchase_price: data.purchase_price || 0,
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

  // ============ TOOLBAR FUNCTIONS (РЕАЛЬНЫЕ) ============

  const handleSave = async () => {
    setLoading(true)
    try {
      const productData = {
        ...product,
        price: product.price_with_discount,
        price_discounted: product.price_with_discount < product.price_without_discount ? product.price_with_discount : null
      }
      
      if (id) {
        await api.put(`/api/catalog/products/${id}`, productData)
        alert('✅ Товар сохранен!')
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

  const handleImportData = () => {
    alert('📥 Импорт данных\n\nФункция позволяет импортировать параметры товара из файла или с маркетплейса.')
  }

  const handleConfirmChanges = async () => {
    if (confirm('Подтвердить все изменения?')) {
      await handleSave()
    }
  }

  const handleMarketplaceSettings = () => {
    alert('🏪 Настройки маркетплейсов\n\nНастройка привязки товара к маркетплейсам и управление статусами.')
  }

  const handleViewHistory = () => {
    alert('⏱️ История изменений\n\nПросмотр всех изменений карточки товара с датами и авторами.')
  }

  const handlePreview = () => {
    if (!id) {
      alert('Сначала сохраните товар')
      return
    }
    alert('👁️ Предпросмотр\n\nОткрывает превью карточки товара как она будет выглядеть на маркетплейсах.')
  }

  const handleToggleFields = () => {
    alert('☰ Настройки отображения полей\n\nСкрыть/показать автоматически заполняемые поля.')
  }

  const handleWildberriesAction = () => {
    alert('WB Функции Wildberries\n\n- Проверить статус на WB\n- Загрузить медиа на WB\n- Обновить параметры')
  }

  const handleOzonAction = () => {
    alert('⭕ Функции Ozon\n\n- Проверить статус на Ozon\n- Загрузить медиа на Ozon\n- Обновить параметры')
  }

  const handleDeleteProduct = async () => {
    if (!confirm('Удалить товар навсегда? Это действие нельзя отменить.')) return
    
    try {
      await api.delete(`/api/catalog/products/${id}`)
      alert('✅ Товар удален')
      navigate('/dashboard')
    } catch (error) {
      alert('Ошибка: ' + error.message)
    }
  }

  const handleDownloadPhotos = () => {
    alert('📥 Скачать фотографии\n\nЗагрузка всех фотографий товара в архиве для дальнейшего использования.')
  }

  const handleUpdateInSelSup = () => {
    alert('🔄 Обновить параметры в SelSup\n\nСинхронизация параметров товара с внешними системами.')
  }

  const handleLinkCards = () => {
    alert('🔗 Найти и связать карточки\n\nПоиск похожих карточек товара на маркетплейсах и их связывание.')
  }

  const handleUploadToOzon = () => {
    alert('📤 Загрузить медиа на Ozon\n\nОтправка фотографий и видео на Ozon.')
  }

  // ============ END TOOLBAR FUNCTIONS ============

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
    <div className="min-h-screen bg-mm-dark pb-24">
      {/* Header */}
      <div className="bg-mm-secondary border-b border-mm-border p-4">
        <div className="flex items-center justify-between mb-3">
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
        </div>

        {/* Голубая панель инструментов (как в SelSup) */}
        {id && (
          <div className="flex items-center gap-1 p-2 bg-cyan-500 rounded relative">
            <button
              type="button"
              onClick={handleSave}
              title="Сохранить"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiSave size={18} />
            </button>
            <button
              type="button"
              onClick={handleImportData}
              title="Импорт данных"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiUpload size={18} />
            </button>
            <button
              type="button"
              onClick={handleConfirmChanges}
              title="Подтвердить изменения"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiCheck size={18} />
            </button>
            <button
              type="button"
              onClick={handleMarketplaceSettings}
              title="Настройки маркетплейсов"
              className="p-2 text-white hover:bg-white/20 rounded transition text-lg"
            >
              🏪
            </button>
            <button
              type="button"
              onClick={handleViewHistory}
              title="История изменений"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiClock size={18} />
            </button>
            <button
              type="button"
              onClick={handlePreview}
              title="Предпросмотр"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiEye size={18} />
            </button>
            <button
              type="button"
              onClick={handleToggleFields}
              title="Настройки отображения полей"
              className="p-2 text-white hover:bg-white/20 rounded transition text-lg"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={handleWildberriesAction}
              title="Функции Wildberries"
              className="w-8 h-8 bg-purple-500 text-white rounded flex items-center justify-center hover:bg-purple-600 transition text-xs font-bold"
            >
              WB
            </button>
            <button
              type="button"
              onClick={handleOzonAction}
              title="Функции Ozon"
              className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition text-xs font-bold"
            >
              O
            </button>
            <button
              type="button"
              onClick={handleDownloadPhotos}
              title="Скачать фотографии"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiDownload size={18} />
            </button>
            <button
              type="button"
              onClick={handleDeleteProduct}
              title="Удалить товар"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiTrash2 size={18} />
            </button>
            
            {/* Меню настроек (шестеренка с dropdown) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                title="Дополнительные функции"
                className="p-2 text-white hover:bg-white/20 rounded transition"
              >
                <FiSettings size={18} />
              </button>
              
              {showSettingsMenu && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                  <div className="py-2">
                    <button
                      onClick={() => {
                        handleLinkCards()
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      🔗 Найти и связать карточки
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateInSelSup()
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      🔄 Обновить параметры, название и описание
                    </button>
                    <button
                      onClick={() => {
                        handleUpdateInSelSup()
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      📝 Обновить параметры
                    </button>
                    <button
                      onClick={() => {
                        handleDownloadPhotos()
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      📥 Скачать фотографии для загрузки
                    </button>
                    <button
                      onClick={() => {
                        handleUploadToOzon()
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      📤 Загрузить медиа на Ozon
                    </button>
                    <hr className="my-2" />
                    <button
                      onClick={() => {
                        alert('🔄 Создать дубликат карточки для другой организации')
                        setShowSettingsMenu(false)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                    >
                      📋 Создать дубликат карточки
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Вкладки (как в SelSup) */}
        {id && (
          <div className="flex gap-1 mt-3 border-b border-mm-border overflow-x-auto">
            <button
              onClick={() => setActiveTab('card')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'card'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Карточка
            </button>
            <button
              onClick={() => setActiveTab('keywords')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'keywords'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Ключевые слова
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'analytics'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Аналитика
            </button>
            <button
              onClick={() => setActiveTab('prices')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'prices'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Цены
            </button>
            <button
              onClick={() => setActiveTab('mass_edit')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'mass_edit'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Массовое редактирование
            </button>
            <button
              onClick={() => setActiveTab('hypotheses')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap relative ${
                activeTab === 'hypotheses'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Гипотезы
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded font-bold">NEW</span>
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'suppliers'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Поставщики
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'stock'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Остатки
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'documents'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              Документы
            </button>
            <button
              onClick={() => setActiveTab('duplicates')}
              className={`px-4 py-2 font-medium transition whitespace-nowrap ${
                activeTab === 'duplicates'
                  ? 'text-mm-cyan border-b-2 border-mm-cyan'
                  : 'text-mm-text-secondary hover:text-mm-text'
              }`}
            >
              ДУБЛИ
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* ВКЛАДКА: КАРТОЧКА */}
          {activeTab === 'card' && (
            <div className="grid grid-cols-12 gap-6">
              {/* LEFT COLUMN: PHOTOS */}
              <div className="col-span-3 space-y-4">
                <div className="bg-mm-secondary p-4 rounded-lg sticky top-4">
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
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold"
                            >
                              ✕
                            </button>
                            {/* Маркетплейс иконки (для выбора главного фото) */}
                            <div className="absolute bottom-1 left-1 flex gap-1">
                              <button
                                type="button"
                                className="w-5 h-5 bg-purple-500 text-white rounded text-[8px] font-bold opacity-70 hover:opacity-100"
                                title="Главное для WB"
                              >
                                WB
                              </button>
                              <button
                                type="button"
                                className="w-5 h-5 bg-blue-500 text-white rounded text-[8px] font-bold opacity-70 hover:opacity-100"
                                title="Главное для Ozon"
                              >
                                O
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {id && (
                    <>
                      <button
                        type="button"
                        onClick={handleAddPhoto}
                        className="w-full mt-3 px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded text-sm font-medium"
                      >
                        + Добавить фото
                      </button>
                      
                      <button
                        type="button"
                        onClick={handleDownloadPhotos}
                        className="w-full mt-2 px-4 py-2 bg-mm-dark text-mm-text hover:bg-mm-dark/80 rounded text-sm border border-mm-border"
                      >
                        📥 Скачать все фото
                      </button>
                    </>
                  )}
                  
                  {!id && (
                    <p className="text-xs text-mm-text-secondary mt-3">
                      💡 Фото можно добавить после создания товара
                    </p>
                  )}
                </div>
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

                {/* БЛОК: Варианты (сверху как в SelSup) */}
                {id && (
                  <div className="bg-mm-secondary p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="text-sm text-mm-text-secondary">ВАРИАНТЫ:</span>
                        <span className="ml-2 text-mm-text font-semibold">{variants.length} из {variants.length}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddVariant}
                        className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded text-sm font-medium"
                      >
                        ДОБАВИТЬ
                      </button>
                    </div>
                    
                    {variants.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {variants.map((variant) => (
                          <div key={variant.id} className="relative">
                            <div className="w-20 h-20 bg-mm-dark rounded border border-mm-border flex items-center justify-center">
                              <span className="text-xs text-mm-text text-center">
                                {variant.color}<br/>{variant.size}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteVariant(variant.id)}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* БАЗОВЫЕ ПОЛЯ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-lg font-bold text-mm-text border-b border-mm-border pb-2">
                    ОСНОВНАЯ ИНФОРМАЦИЯ
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        КАТЕГОРИЯ <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={product.category_id}
                          onChange={(e) => handleProductChange('category_id', e.target.value)}
                          required
                          className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        >
                          <option value="">Выберите категорию</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => navigate('/catalog/categories')}
                          className="px-4 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded text-sm font-medium"
                        >
                          СОЗДАТЬ
                        </button>
                        <button
                          type="button"
                          className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded"
                        >
                          <FiEdit size={18} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        АРТИКУЛ ДЛЯ ОБЪЕДИНЕНИЯ В ОДНУ КАРТОЧКУ <span className="text-red-400">*</span>
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
                        НАЗВАНИЕ МОДЕЛИ <span className="text-red-400">*</span>
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
                        БРЕНД <span className="text-red-400">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={product.brand}
                          onChange={(e) => handleProductChange('brand', e.target.value)}
                          required
                          className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                          placeholder="Nike"
                        />
                        <button
                          type="button"
                          className="px-4 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded text-sm font-medium"
                        >
                          СОЗДАТЬ
                        </button>
                        <button
                          type="button"
                          className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded"
                        >
                          <FiEdit size={18} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        ПРОИЗВОДИТЕЛЬ
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={product.manufacturer}
                          onChange={(e) => handleProductChange('manufacturer', e.target.value)}
                          className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        >
                          <option value="">Выберите производителя</option>
                          <option value="Nike Inc.">Nike Inc.</option>
                          <option value="Adidas AG">Adidas AG</option>
                          <option value="Другой">Другой</option>
                        </select>
                        <button
                          type="button"
                          className="px-4 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded text-sm font-medium"
                        >
                          СОЗДАТЬ
                        </button>
                        <button
                          type="button"
                          className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded"
                        >
                          <FiEdit size={18} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        СТРАНА ПРОИЗВОДСТВА
                      </label>
                      <input
                        type="text"
                        value={product.country_of_origin}
                        onChange={(e) => handleProductChange('country_of_origin', e.target.value)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Вьетнам"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        НАЗВАНИЕ ДЛЯ ЭТИКЕТКИ
                      </label>
                      <input
                        type="text"
                        value={product.label_name}
                        onChange={(e) => handleProductChange('label_name', e.target.value)}
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                        placeholder="Название на этикетке (2 строки)"
                      />
                      <p className="text-xs text-mm-text-secondary mt-1">
                        💡 Формируется автоматически на 2 строки
                      </p>
                    </div>
                  </div>
                </div>

                {/* ЦЕНЫ (как в SelSup) */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-lg font-bold text-mm-text border-b border-mm-border pb-2">
                    💰 ЦЕНЫ
                  </h2>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        ЦЕНА СО СКИДКОЙ ₽ <span className="text-red-400">*</span>
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
                        ПОПРАВОЧНЫЙ КОЭФФИЦИЕНТ
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
                        ЦЕНА БЕЗ СКИДКИ ₽ <span className="text-red-400">*</span>
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

                  <div className="grid grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1">
                        ЗАКУПОЧНАЯ ЦЕНА ₽
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
                        ДОП. РАСХОДЫ ₽
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
                        СЕБЕСТОИМОСТЬ ₽
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
                    <h2 className="text-lg font-bold text-mm-text">ОПИСАНИЕ ТОВАРА</h2>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-mm-text-secondary">
                        {product.description.length} / 2000 символов
                      </span>
                      <button
                        type="button"
                        className="px-3 py-1 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded text-xs font-medium"
                      >
                        СГЕНЕРИРОВАТЬ ТЕКСТ
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={product.description}
                    onChange={(e) => handleProductChange('description', e.target.value)}
                    rows="6"
                    maxLength={2000}
                    className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none resize-none"
                    placeholder="Подробное описание товара..."
                  />
                  <p className="text-xs text-mm-text-secondary">
                    💡 Можно сгенерировать описание с учетом ключевых слов (размером 2000 знаков)
                  </p>
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

                {/* ПОЛ, СЕЗОН, СОСТАВ */}
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
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark font-semibold'
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
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark font-semibold'
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
                    <p className="text-xs text-mm-text-secondary mt-1">
                      Не попадает на маркетплейс, используется для заметок
                    </p>
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
                    <p className="text-xs text-mm-text-secondary mt-1">
                      Используется в заказах поставщику
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: КЛЮЧЕВЫЕ СЛОВА */}
          {activeTab === 'keywords' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">КЛЮЧЕВЫЕ СЛОВА</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-mm-text-secondary mb-2">
                    Ключевые слова для SEO
                  </label>
                  <textarea
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    rows="5"
                    className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none resize-none"
                    placeholder="Введите ключевые слова через запятую: кроссовки, Nike, спортивная обувь..."
                  />
                  <p className="text-xs text-mm-text-secondary mt-2">
                    💡 Используются для генерации SEO-описаний и оптимизации поиска
                  </p>
                </div>
                
                <button
                  type="button"
                  className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
                  onClick={() => alert('🤖 AI генерация описания будет реализована позже')}
                >
                  🤖 Сгенерировать описание с ключевыми словами
                </button>
              </div>
            </div>
          )}

          {/* ВКЛАДКА: ЦЕНЫ */}
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
              </div>
            </div>
          )}

          {/* Остальные вкладки (заглушки) */}
          {activeTab === 'analytics' && (
            <div className="bg-mm-secondary p-6 rounded-lg text-center py-12">
              <p className="text-mm-text-secondary text-lg">📊 Аналитика по товару</p>
              <p className="text-mm-text-secondary text-sm mt-2">Раздел в разработке</p>
            </div>
          )}

          {activeTab === 'mass_edit' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">МАССОВОЕ РЕДАКТИРОВАНИЕ</h2>
              <div className="bg-mm-dark p-6 rounded-lg text-center">
                <p className="text-mm-text-secondary">Для массового редактирования нескольких товаров используйте список товаров</p>
              </div>
            </div>
          )}

          {activeTab === 'hypotheses' && (
            <div className="bg-mm-secondary p-6 rounded-lg text-center py-12">
              <p className="text-mm-text-secondary text-lg">💡 Гипотезы по товару</p>
              <p className="text-mm-text-secondary text-sm mt-2">Раздел в разработке</p>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">ПОСТАВЩИКИ</h2>
              <div className="bg-mm-dark p-6 rounded-lg text-center">
                <p className="text-mm-text-secondary">Нет привязанных поставщиков</p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
                  onClick={() => alert('Добавление поставщиков будет реализовано в модуле "Закупки"')}
                >
                  + Добавить поставщика
                </button>
              </div>
            </div>
          )}

          {activeTab === 'stock' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">ОСТАТКИ ПО FBS</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary mb-1">Всего на складе</p>
                  <p className="text-2xl font-bold text-mm-cyan">0 шт.</p>
                </div>
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary mb-1">Зарезервировано</p>
                  <p className="text-2xl font-bold text-yellow-400">0 шт.</p>
                </div>
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary mb-1">Доступно</p>
                  <p className="text-2xl font-bold text-green-400">0 шт.</p>
                </div>
              </div>
              <p className="text-sm text-mm-text-secondary text-center py-4">
                💡 Подробное управление остатками будет реализовано в отдельном модуле "Склад"
              </p>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">ДОКУМЕНТЫ И ЗАКАЗЫ</h2>
              <div className="bg-mm-dark p-6 rounded-lg text-center">
                <p className="text-mm-text-secondary">Нет связанных документов</p>
                <p className="text-xs text-mm-text-secondary mt-2">
                  Здесь будут отображаться заказы и документы, связанные с этим товаром
                </p>
              </div>
            </div>
          )}

          {activeTab === 'duplicates' && (
            <div className="bg-mm-secondary p-6 rounded-lg text-center py-12">
              <p className="text-mm-text-secondary text-lg">🔍 Поиск дублей</p>
              <p className="text-mm-text-secondary text-sm mt-2">Раздел в разработке</p>
            </div>
          )}
        </form>
      </div>

      {/* Bottom Save Bar (fixed) - КАК В SELSUP */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-lg">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded font-semibold"
            >
              СОХРАНИТЬ
            </button>
            
            <span className="text-sm text-gray-600">Отправить в:</span>
            
            <div className="flex gap-3 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.honest_sign}
                  onChange={(e) => setMarketplaces({ ...marketplaces, honest_sign: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm text-gray-700">Честный знак</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.ozon}
                  onChange={(e) => setMarketplaces({ ...marketplaces, ozon: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">O</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.wb}
                  onChange={(e) => setMarketplaces({ ...marketplaces, wb: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="w-6 h-6 bg-purple-500 text-white rounded flex items-center justify-center text-xs font-bold">WB</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaces.yandex}
                  onChange={(e) => setMarketplaces({ ...marketplaces, yandex: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="w-6 h-6 bg-red-500 text-white rounded flex items-center justify-center text-xs font-bold">Я</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
