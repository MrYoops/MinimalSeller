import React, { useState, useEffect } from 'react'
import { FiArrowLeft, FiPlus, FiTrash2, FiSave, FiImage, FiEdit, FiEye, FiDownload, FiUpload, FiSettings, FiClock, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import UnifiedCategorySelector from '../components/UnifiedCategorySelector'
import ProductCharacteristics from '../components/ProductCharacteristics'
import MarketplaceCharacteristics from '../components/MarketplaceCharacteristics'
import UnifiedMarketplaceCharacteristics from '../components/UnifiedMarketplaceCharacteristics'
import { FiLoader } from 'react-icons/fi'

export default function CatalogProductFormV4() {
  const { api } = useAuth()
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('card')
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  
  const [categories, setCategories] = useState([])
  
  // Маркетплейсы (чекбоксы внизу)
  const [selectedMarketplaces, setSelectedMarketplaces] = useState({
    wb: false,
    ozon: false,
    yandex: false,
    honest_sign: false
  })
  
  // Данные специфичные для каждого маркетплейса
  const [marketplaceData, setMarketplaceData] = useState({
    wb: { name: '', description: '', characteristics: {} },
    ozon: { name: '', description: '', characteristics: {} },
    yandex: { name: '', description: '', characteristics: {} }
  })
  
  // Категории маркетплейсов (как в SelSup)
  const [categoryMappings, setCategoryMappings] = useState({
    ozon: { category_id: null, category_name: '', type_id: null },
    wb: { category_id: null, category_name: '' },
    yandex: { category_id: null, category_name: '' }
  })
  
  // Обязательные атрибуты для каждого маркетплейса
  const [requiredAttributes, setRequiredAttributes] = useState({
    ozon: {},
    wb: {},
    yandex: {}
  })
  
  // Основные данные товара
  // Характеристики по маркетплейсам
  const [mpCharacteristics, setMpCharacteristics] = useState({
    wb: [],
    ozon: [],
    yandex: []
  })
  const [loadingCharacteristics, setLoadingCharacteristics] = useState({
    wb: false,
    ozon: false,
    yandex: false
  })
  const [characteristicsAttempted, setCharacteristicsAttempted] = useState({
    wb: false,
    ozon: false,
    yandex: false
  })
  
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
    dimensions: { length: 0, width: 0, height: 0 },
    
    gender: '',
    season: '',
    composition: '',
    care_instructions: '',
    additional_info: '',
    website_link: '',
    
    characteristics: {}
  })
  
  const [variants, setVariants] = useState([])
  const [photos, setPhotos] = useState([])
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

  // Инициализация marketplace data при выборе маркетплейса
  useEffect(() => {
    Object.keys(selectedMarketplaces).forEach(mp => {
      if (selectedMarketplaces[mp] && !marketplaceData[mp]?.name) {
        setMarketplaceData(prev => ({
          ...prev,
          [mp]: {
            name: product.name,
            description: product.description,
            characteristics: product.characteristics
          }
        }))
      }
    })
  }, [selectedMarketplaces])

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
        website_link: data.website_link || '',
        characteristics: data.characteristics || {}
      })
      
      // Загрузить данные маркетплейсов если есть
      if (data.marketplace_specific_data) {
        setMarketplaceData(data.marketplace_specific_data)
      }
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

  // ============ TOOLBAR FUNCTIONS ============

  const handleSave = async () => {
    setLoading(true)
    try {
      const productData = {
        ...product,
        price: product.price_with_discount,
        price_discounted: product.price_with_discount < product.price_without_discount ? product.price_with_discount : null
      }
      
      // Проверить, нужно ли отправлять на маркетплейсы
      const hasSelectedMarketplaces = Object.values(selectedMarketplaces).some(v => v)
      
      if (hasSelectedMarketplaces && id) {
        // Сохранить с отправкой на маркетплейсы
        const response = await api.post(`/api/catalog/products/${id}/save-with-marketplaces`, {
          product: productData,
          marketplaces: selectedMarketplaces,
          marketplace_data: marketplaceData,
          category_mappings: categoryMappings,
          required_attributes: requiredAttributes
        })
        
        // Показать детальный результат
        let message = response.data.message + '\n\n'
        const results = response.data.marketplace_results || {}
        
        Object.keys(results).forEach(mp => {
          const result = results[mp]
          if (result.success) {
            message += `✅ ${mp.toUpperCase()}: ${result.message}\n`
          } else {
            message += `❌ ${mp.toUpperCase()}: ${result.error}\n`
          }
        })
        
        alert(message)
        
        // Перезагрузить данные
        loadProduct()
      } else {
        // Обычное сохранение
        if (id) {
          await api.put(`/api/catalog/products/${id}`, productData)
          alert('✅ Товар сохранен!')
          loadProduct()
        } else {
          const response = await api.post('/api/catalog/products', productData)
          alert('✅ Товар создан!')
          navigate(`/catalog/products/${response.data.id}/edit`)
        }
      }
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateFromMarketplace = async (marketplace) => {
    if (!id) {
      alert('Сначала создайте товар')
      return
    }
    
    const marketplaceProductId = prompt(`Введите ID товара на ${marketplace.toUpperCase()}:`)
    if (!marketplaceProductId) return
    
    setLoading(true)
    try {
      const response = await api.post(`/api/catalog/products/${id}/update-from-marketplace`, {
        marketplace,
        marketplace_product_id: marketplaceProductId
      })
      
      alert(`✅ ${response.data.message}\n\n` +
        `Название: ${response.data.details.name}\n` +
        `Описание: ${response.data.details.description_length} символов\n` +
        `Характеристик: ${response.data.details.characteristics_count}\n` +
        `Фото добавлено: ${response.data.details.photos_added}`)
      
      // Перезагрузить данные
      loadProduct()
      loadPhotos()
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleUploadMediaToMarketplace = async (marketplace) => {
    if (!id) {
      alert('Сначала создайте товар')
      return
    }
    
    if (!confirm(`Загрузить фотографии на ${marketplace.toUpperCase()}?`)) return
    
    setLoading(true)
    try {
      const response = await api.post(`/api/catalog/products/${id}/upload-media/${marketplace}`)
      alert(`✅ ${response.data.message}`)
    } catch (error) {
      alert('❌ Ошибка: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPhotos = () => {
    if (photos.length === 0) {
      alert('Нет фотографий для скачивания')
      return
    }
    
    alert(`📥 Скачивание ${photos.length} фотографий\n\nФункция будет реализована в следующей версии`)
  }

  const handlePreview = () => {
    if (!id) {
      alert('Сначала сохраните товар')
      return
    }
    alert('👁️ Предпросмотр карточки товара\n\nОткроется в новом окне (функция в разработке)')
  }

  const handleViewHistory = () => {
    alert('⏱️ История изменений товара\n\nПросмотр всех изменений с датами и авторами (в разработке)')
  }

  const handleProductChange = (field, value) => {
    setProduct(prev => ({ ...prev, [field]: value }))
  }
  
  // Загрузка характеристик при выборе маркетплейса
  const loadMarketplaceCharacteristics = async (marketplace, categoryMappingId) => {
    if (!categoryMappingId) {
      alert('Сначала выберите категорию товара')
      return
    }
    
    setLoadingCharacteristics(prev => ({ ...prev, [marketplace]: true }))
    setCharacteristicsAttempted(prev => ({ ...prev, [marketplace]: true }))
    
    try {
      // Маппинг кратких названий на полные (для совместимости с БД)
      const marketplaceKeys = {
        'ozon': 'ozon',
        'wb': 'wildberries',
        'yandex': 'yandex'
      }
      
      const dbKey = marketplaceKeys[marketplace] || marketplace
      
      // Получить mapping чтобы узнать category_id для маркетплейса
      const mappingResponse = await api.get(`/api/categories/mappings/${categoryMappingId}`)
      const mapping = mappingResponse.data
      
      console.log('[loadMarketplaceCharacteristics] Mapping:', mapping)
      console.log('[loadMarketplaceCharacteristics] Looking for key:', dbKey)
      
      const categoryId = mapping.marketplace_categories?.[dbKey]
      const typeId = mapping.marketplace_type_ids?.[dbKey]
      
      console.log('[loadMarketplaceCharacteristics] Found categoryId:', categoryId, 'typeId:', typeId)
      
      if (!categoryId) {
        console.warn(`Category not mapped to ${marketplace}`)
        // Не загружаем характеристики, но не показываем ошибку
        // Пользователь может использовать товар без этого маркетплейса
        setMpCharacteristics(prev => ({
          ...prev,
          [marketplace]: []
        }))
        return
      }
      
      // Загрузить характеристики
      let url = `/api/categories/marketplace/${marketplace}/${categoryId}/attributes`
      if (typeId && marketplace === 'ozon') {
        url += `?type_id=${typeId}`
      }
      
      const response = await api.get(url)
      const characteristics = response.data.attributes || []
      
      setMpCharacteristics(prev => ({
        ...prev,
        [marketplace]: characteristics
      }))
      
      console.log(`✅ Загружено ${characteristics.length} характеристик для ${marketplace}`)
      
    } catch (error) {
      console.error(`Failed to load ${marketplace} characteristics:`, error)
      alert(`Ошибка загрузки характеристик ${marketplace}: ${error.response?.data?.detail || error.message}`)
    } finally {
      setLoadingCharacteristics(prev => ({ ...prev, [marketplace]: false }))
    }
  }
  
  // Загрузка характеристик при изменении нижних галочек
  useEffect(() => {
    const loadCharacteristicsForSelectedMarketplaces = async () => {
      console.log('[ProductForm] Loading characteristics, category_mapping_id:', product.category_mapping_id)
      console.log('[ProductForm] Selected marketplaces:', selectedMarketplaces)
      
      if (!product.category_mapping_id) {
        console.log('[ProductForm] No category_mapping_id, skipping')
        return
      }
      
      // Проверяем каждый маркетплейс
      for (const mp of ['ozon', 'wb', 'yandex']) {
        // Если галочка включена И (характеристики не загружены ИЛИ еще не пытались загрузить)
        if (selectedMarketplaces[mp] && !characteristicsAttempted[mp] && !loadingCharacteristics[mp]) {
          console.log(`[ProductForm] Loading characteristics for ${mp}`)
          await loadMarketplaceCharacteristics(mp, product.category_mapping_id)
        }
      }
    }
    
    loadCharacteristicsForSelectedMarketplaces()
  }, [selectedMarketplaces.ozon, selectedMarketplaces.wb, selectedMarketplaces.yandex, product.category_mapping_id])
  
  // Миграция данных: копирование общих характеристик между МП
  useEffect(() => {
    if (!product.marketplace_data || activeMarketplaces.length < 2) return
    
    const migrateCommonCharacteristics = () => {
      // Собираем все имена характеристик по всем МП
      const allCharNames = new Set()
      const charsByMp = {}
      
      activeMarketplaces.forEach(mp => {
        const chars = mpCharacteristics[mp] || []
        charsByMp[mp] = chars.map(c => c.name || c.attribute_name || c.charcName)
        chars.forEach(c => {
          const name = c.name || c.attribute_name || c.charcName
          allCharNames.add(name)
        })
      })
      
      // Находим характеристики, которые есть в нескольких МП (общие)
      const commonCharNames = Array.from(allCharNames).filter(charName => {
        const mpCount = activeMarketplaces.filter(mp => charsByMp[mp]?.includes(charName)).length
        return mpCount > 1
      })
      
      if (commonCharNames.length === 0) return
      
      // Копируем значения общих полей
      let updated = false
      const newMarketplaceData = { ...product.marketplace_data }
      
      commonCharNames.forEach(charName => {
        // Находим МП где это поле уже заполнено
        const mpWithValue = activeMarketplaces.find(mp => 
          newMarketplaceData[mp]?.characteristics?.[charName]
        )
        
        if (mpWithValue) {
          const value = newMarketplaceData[mpWithValue].characteristics[charName]
          
          // Копируем в другие МП где это поле есть но не заполнено
          activeMarketplaces.forEach(mp => {
            if (mp !== mpWithValue && charsByMp[mp]?.includes(charName)) {
              if (!newMarketplaceData[mp]?.characteristics?.[charName]) {
                if (!newMarketplaceData[mp]) {
                  newMarketplaceData[mp] = { characteristics: {} }
                }
                if (!newMarketplaceData[mp].characteristics) {
                  newMarketplaceData[mp].characteristics = {}
                }
                newMarketplaceData[mp].characteristics[charName] = value
                updated = true
              }
            }
          })
        }
      })
      
      if (updated) {
        console.log('[Migration] Migrated common characteristics values between marketplaces')
        setProduct(prev => ({
          ...prev,
          marketplace_data: newMarketplaceData
        }))
      }
    }
    
    // Задержка чтобы не срабатывало на каждом изменении
    const timer = setTimeout(migrateCommonCharacteristics, 500)
    return () => clearTimeout(timer)
  }, [mpCharacteristics, selectedMarketplaces])

  const activeMarketplaces = Object.keys(selectedMarketplaces).filter(mp => selectedMarketplaces[mp])

  const handleMarketplaceDataChange = (marketplace, field, value) => {
    setMarketplaceData(prev => ({
      ...prev,
      [marketplace]: {
        ...prev[marketplace],
        [field]: value
      }
    }))
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

  if (loading && id) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mm-cyan"></div>
        <p className="text-mm-text-secondary mt-4">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mm-dark pb-32">
      {/* Header */}
      <div className="bg-mm-secondary border-b border-mm-border p-4">
        <div className="flex items-center gap-4 mb-3">
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

        {/* Голубая панель инструментов */}
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
              title="Импорт данных"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiUpload size={18} />
            </button>
            <button
              type="button"
              onClick={handleSave}
              title="Подтвердить изменения"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiCheck size={18} />
            </button>
            <button
              type="button"
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
              title="Настройки отображения полей"
              className="p-2 text-white hover:bg-white/20 rounded transition text-lg"
            >
              ☰
            </button>
            <button
              type="button"
              onClick={() => handleUploadMediaToMarketplace('wb')}
              title="Функции Wildberries"
              className="w-8 h-8 bg-purple-600 text-white rounded flex items-center justify-center hover:bg-purple-700 transition text-xs font-bold"
            >
              WB
            </button>
            <button
              type="button"
              onClick={() => handleUploadMediaToMarketplace('ozon')}
              title="Функции Ozon"
              className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 transition text-xs font-bold"
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
              onClick={async () => {
                if (!confirm('Удалить товар навсегда?')) return
                try {
                  await api.delete(`/api/catalog/products/${id}`)
                  alert('✅ Товар удален')
                  navigate('/dashboard')
                } catch (err) {
                  alert('Ошибка: ' + err.message)
                }
              }}
              title="Удалить товар"
              className="p-2 text-white hover:bg-white/20 rounded transition"
            >
              <FiTrash2 size={18} />
            </button>
            
            {/* Меню настроек */}
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
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowSettingsMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50">
                    <div className="py-2">
                      <button
                        onClick={() => {
                          alert('🔗 Найти и связать карточки\n\nПоиск похожих карточек на маркетплейсах')
                          setShowSettingsMenu(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        🔗 Найти и связать карточки
                      </button>
                      <button
                        onClick={() => {
                          const mp = prompt('С какого маркетплейса загрузить? (wb, ozon, yandex)')
                          if (mp) handleUpdateFromMarketplace(mp)
                          setShowSettingsMenu(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        🔄 Обновить параметры, название и описание
                      </button>
                      <button
                        onClick={() => {
                          const mp = prompt('С какого маркетплейса загрузить? (wb, ozon, yandex)')
                          if (mp) handleUpdateFromMarketplace(mp)
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
                          handleUploadMediaToMarketplace('ozon')
                          setShowSettingsMenu(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        📤 Загрузить медиа на Ozon
                      </button>
                      <hr className="my-2" />
                      <button
                        onClick={() => {
                          alert('📋 Создать дубликат карточки\n\nСоздание копии для другой организации')
                          setShowSettingsMenu(false)
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-100 transition"
                      >
                        📋 Создать дубликат карточки
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Вкладки */}
        {id && (
          <div className="flex gap-1 mt-3 border-b border-mm-border overflow-x-auto">
            {['card', 'keywords', 'analytics', 'prices', 'mass_edit', 'hypotheses', 'suppliers', 'stock', 'documents', 'duplicates'].map(tab => {
              const labels = {
                card: 'Карточка',
                keywords: 'Ключевые слова',
                analytics: 'Аналитика',
                prices: 'Цены',
                mass_edit: 'Массовое редактирование',
                hypotheses: 'Гипотезы',
                suppliers: 'Поставщики',
                stock: 'Остатки',
                documents: 'Документы',
                duplicates: 'ДУБЛИ'
              }
              
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium transition whitespace-nowrap relative ${
                    activeTab === tab
                      ? 'text-mm-cyan border-b-2 border-mm-cyan'
                      : 'text-mm-text-secondary hover:text-mm-text'
                  }`}
                >
                  {labels[tab]}
                  {tab === 'hypotheses' && (
                    <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded font-bold">NEW</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          {/* ВКЛАДКА: КАРТОЧКА */}
          {activeTab === 'card' && (
            <div className="grid grid-cols-12 gap-6">
              {/* LEFT: PHOTOS */}
              <div className="col-span-3">
                <div className="bg-mm-secondary p-4 rounded-lg sticky top-4">
                  <h3 className="text-sm font-semibold text-mm-text mb-3">ФОТОГРАФИИ</h3>
                  
                  <div className="space-y-2">
                    {photos.length === 0 ? (
                      <div className="border-2 border-dashed border-mm-border rounded-lg p-8 text-center">
                        <FiImage className="mx-auto text-4xl text-mm-text-secondary mb-2" />
                        <p className="text-sm text-mm-text-secondary">Нет фотографий</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.url}
                              alt="Product"
                              className="w-full h-24 object-cover rounded bg-mm-dark"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-xs font-bold"
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
                </div>
              </div>

              {/* RIGHT: FIELDS */}
              <div className="col-span-9 space-y-6">
                {/* Варианты (сверху) */}
                {id && (
                  <div className="bg-mm-secondary p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-mm-text">
                        <span className="text-mm-text-secondary">ВАРИАНТЫ:</span>
                        <span className="ml-2 font-semibold">{variants.length} из {variants.length}</span>
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          const color = prompt('Цвет:')
                          const size = prompt('Размер:')
                          if (!color || !size) return
                          try {
                            const response = await api.post(`/api/catalog/products/${id}/variants`, {
                              color, size, sku: `${product.article}-${color.slice(0,3).toUpperCase()}-${size}`
                            })
                            setVariants([...variants, response.data])
                          } catch (err) {
                            alert('Ошибка: ' + err.message)
                          }
                        }}
                        className="px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 rounded text-sm font-semibold"
                      >
                        ДОБАВИТЬ
                      </button>
                    </div>
                  </div>
                )}

                {/* ОСНОВНАЯ ИНФОРМАЦИЯ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  {/* ЕДИНЫЙ СЕЛЕКТОР КАТЕГОРИИ */}
                  <UnifiedCategorySelector
                    productName={product.name}
                    initialCategoryMappingId={product.category_mapping_id}
                    selectedMarketplaces={Object.keys(selectedMarketplaces).filter(mp => selectedMarketplaces[mp])}
                    onCategorySelected={(mapping) => {
                      console.log('[ProductForm] Category selected:', mapping)
                      if (mapping) {
                        setProduct(prev => ({ ...prev, category_mapping_id: mapping.id }))
                      } else {
                        setProduct(prev => ({ ...prev, category_mapping_id: null }))
                      }
                    }}
                    onAttributesLoaded={(attributes) => {
                      console.log('[ProductForm] Attributes loaded:', attributes)
                      // Сохранить атрибуты для каждого МП
                      setMarketplaceData(prev => {
                        const updated = { ...prev }
                        Object.keys(attributes).forEach(mp => {
                          if (!updated[mp]) updated[mp] = {}
                          updated[mp].attributes = attributes[mp]
                        })
                        return updated
                      })
                    }}
                  />

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">
                      Артикул для объединения в одну карточку <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={product.article}
                      onChange={(e) => handleProductChange('article', e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">
                      Название модели <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={product.name}
                      onChange={(e) => handleProductChange('name', e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">
                      Бренд <span className="text-red-400">*</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={product.brand}
                        onChange={(e) => handleProductChange('brand', e.target.value)}
                        required
                        className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                      <button type="button" className="px-4 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded text-sm font-semibold">
                        СОЗДАТЬ
                      </button>
                      <button type="button" className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded">
                        <FiEdit size={18} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Производитель</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={product.manufacturer}
                        onChange={(e) => handleProductChange('manufacturer', e.target.value)}
                        className="flex-1 px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                      <button type="button" className="px-4 py-2 bg-cyan-500 text-white hover:bg-cyan-600 rounded text-sm font-semibold">
                        СОЗДАТЬ
                      </button>
                      <button type="button" className="p-2 text-mm-cyan hover:bg-mm-cyan/10 rounded">
                        <FiEdit size={18} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Страна производства</label>
                    <input
                      type="text"
                      value={product.country_of_origin}
                      onChange={(e) => handleProductChange('country_of_origin', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Название для этикетки</label>
                    <input
                      type="text"
                      value={product.label_name}
                      onChange={(e) => handleProductChange('label_name', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                    />
                  </div>
                </div>

                {/* ЦЕНЫ */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <h2 className="text-sm font-bold text-mm-text-secondary uppercase">Цены</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1 uppercase">
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
                      <label className="block text-sm text-mm-text-secondary mb-1 uppercase">
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
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Закупочная ₽</label>
                      <input
                        type="number"
                        value={product.purchase_price / 100}
                        onChange={(e) => handleProductChange('purchase_price', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Доп. расходы ₽</label>
                      <input
                        type="number"
                        value={product.additional_expenses / 100}
                        onChange={(e) => handleProductChange('additional_expenses', Math.round(parseFloat(e.target.value || 0) * 100))}
                        step="0.01"
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Себестоимость ₽</label>
                      <input
                        type="number"
                        value={product.cost_price / 100}
                        readOnly
                        className="w-full px-3 py-2 bg-mm-dark/50 border border-mm-border rounded text-mm-text-secondary cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* ОПИСАНИЕ */}
                <div className="bg-mm-secondary p-6 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-mm-text-secondary uppercase">Описание</label>
                    <span className="text-xs text-mm-text-secondary">{product.description.length} / 2000</span>
                  </div>
                  <textarea
                    value={product.description}
                    onChange={(e) => handleProductChange('description', e.target.value)}
                    rows="5"
                    maxLength={2000}
                    className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none resize-none"
                  />
                </div>

                {/* ГАБАРИТЫ */}
                <div className="bg-mm-secondary p-6 rounded-lg">
                  <h2 className="text-sm font-bold text-mm-text-secondary uppercase mb-3">Размер и вес с упаковкой</h2>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-mm-text-secondary mb-1">Длина, мм <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        value={product.dimensions.length}
                        onChange={(e) => handleProductChange('dimensions', { ...product.dimensions, length: parseInt(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-mm-text-secondary mb-1">Ширина, мм <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        value={product.dimensions.width}
                        onChange={(e) => handleProductChange('dimensions', { ...product.dimensions, width: parseInt(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-mm-text-secondary mb-1">Высота, мм <span className="text-red-400">*</span></label>
                      <input
                        type="number"
                        value={product.dimensions.height}
                        onChange={(e) => handleProductChange('dimensions', { ...product.dimensions, height: parseInt(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-mm-text-secondary mb-1">Вес, г <span className="text-red-400">*</span></label>
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

                {/* ХАРАКТЕРИСТИКИ ТОВАРА */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-6">
                  <h2 className="text-sm font-bold text-mm-text-secondary uppercase mb-4">
                    Характеристики товара
                  </h2>
                  
                  {/* Базовые характеристики (если есть) */}
                  {Object.keys(product.characteristics || {}).length > 0 && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">
                        Базовые характеристики ({Object.keys(product.characteristics || {}).length} шт)
                      </h3>
                      <ProductCharacteristics
                        characteristics={product.characteristics || {}}
                        onChange={(newCharacteristics) => handleProductChange('characteristics', newCharacteristics)}
                      />
                    </div>
                  )}
                  
                  {/* Подсказка */}
                  {/* Единая секция характеристик со smart-объединением */}
                  <UnifiedMarketplaceCharacteristics
                    selectedMarketplaces={selectedMarketplaces}
                    characteristicsByMarketplace={mpCharacteristics}
                    valuesByMarketplace={{
                      wb: product.marketplace_data?.wb?.characteristics || {},
                      ozon: product.marketplace_data?.ozon?.characteristics || {},
                      yandex: product.marketplace_data?.yandex?.characteristics || {}
                    }}
                    baseCharacteristics={product.characteristics || {}}
                    onChange={(mp, charId, charName, value) => {
                      setProduct(prev => ({
                        ...prev,
                        marketplace_data: {
                          ...prev.marketplace_data,
                          [mp]: {
                            ...prev.marketplace_data?.[mp],
                            characteristics: {
                              ...prev.marketplace_data?.[mp]?.characteristics,
                              [charName]: value
                            }
                          }
                        }
                      }))
                    }}
                    loading={loadingCharacteristics}
                  />
                </div>

                {/* ПОЛ И СЕЗОН */}
                <div className="bg-mm-secondary p-6 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-2 uppercase">Пол</label>
                    <div className="flex gap-2">
                      {['МУЖСКОЙ', 'МАЛЬЧИКИ', 'ЖЕНСКИЙ', 'ДЕВОЧКИ'].map(g => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => handleProductChange('gender', product.gender === g ? '' : g)}
                          className={`px-4 py-2 rounded border transition ${
                            product.gender === g
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark font-semibold'
                              : 'bg-mm-dark border-mm-border text-mm-text hover:border-mm-cyan'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-2 uppercase">Сезон</label>
                    <div className="flex gap-2 flex-wrap">
                      {['КРУГЛОГОДИЧНЫЙ', 'ЗИМА', 'ЛЕТО', 'ВЕСНА', 'ОСЕНЬ'].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleProductChange('season', product.season === s ? '' : s)}
                          className={`px-4 py-2 rounded border transition ${
                            product.season === s
                              ? 'bg-mm-cyan border-mm-cyan text-mm-dark font-semibold'
                              : 'bg-mm-dark border-mm-border text-mm-text hover:border-mm-cyan'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-mm-text-secondary mb-1 uppercase">Состав</label>
                    <input
                      type="text"
                      value={product.composition}
                      onChange={(e) => handleProductChange('composition', e.target.value)}
                      className="w-full px-3 py-2 bg-mm-dark border border-mm-border rounded text-mm-text focus:border-mm-cyan outline-none"
                    />
                  </div>
                </div>

                {/* ПОЛЯ ДЛЯ МАРКЕТПЛЕЙСОВ (появляются при выборе чекбокса) */}
                {selectedMarketplaces.wb && (
                  <div className="bg-purple-500/10 border-2 border-purple-500 p-6 rounded-lg space-y-4">
                    <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                      <span className="w-8 h-8 bg-purple-500 text-white rounded flex items-center justify-center text-sm font-bold">WB</span>
                      WILDBERRIES - Специфичные поля
                    </h2>
                    
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Название для WB</label>
                      <input
                        type="text"
                        value={marketplaceData.wb.name}
                        onChange={(e) => handleMarketplaceDataChange('wb', 'name', e.target.value)}
                        placeholder={product.name}
                        className="w-full px-3 py-2 bg-mm-dark border border-purple-500/50 rounded text-mm-text focus:border-purple-400 outline-none"
                      />
                      <p className="text-xs text-purple-300/70 mt-1">Оставьте пустым для использования общего названия</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm text-purple-300 mb-1">Описание для WB</label>
                      <textarea
                        value={marketplaceData.wb.description}
                        onChange={(e) => handleMarketplaceDataChange('wb', 'description', e.target.value)}
                        placeholder={product.description}
                        rows="3"
                        className="w-full px-3 py-2 bg-mm-dark border border-purple-500/50 rounded text-mm-text focus:border-purple-400 outline-none resize-none"
                      />
                      <p className="text-xs text-purple-300/70 mt-1">Оставьте пустым для использования общего описания</p>
                    </div>
                  </div>
                )}

                {selectedMarketplaces.ozon && (
                  <div className="bg-blue-500/10 border-2 border-blue-500 p-6 rounded-lg space-y-4">
                    <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                      <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">O</span>
                      OZON - Специфичные поля
                    </h2>
                    
                    <div>
                      <label className="block text-sm text-blue-300 mb-1">Название для Ozon</label>
                      <input
                        type="text"
                        value={marketplaceData.ozon.name}
                        onChange={(e) => handleMarketplaceDataChange('ozon', 'name', e.target.value)}
                        placeholder={product.name}
                        className="w-full px-3 py-2 bg-mm-dark border border-blue-500/50 rounded text-mm-text focus:border-blue-400 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-blue-300 mb-1">Аннотация для Ozon</label>
                      <textarea
                        value={marketplaceData.ozon.description}
                        onChange={(e) => handleMarketplaceDataChange('ozon', 'description', e.target.value)}
                        placeholder={product.description}
                        rows="3"
                        className="w-full px-3 py-2 bg-mm-dark border border-blue-500/50 rounded text-mm-text focus:border-blue-400 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}

                {selectedMarketplaces.yandex && (
                  <div className="bg-red-500/10 border-2 border-red-500 p-6 rounded-lg space-y-4">
                    <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
                      <span className="w-8 h-8 bg-red-500 text-white rounded flex items-center justify-center text-sm font-bold">Я</span>
                      ЯНДЕКС.МАРКЕТ - Специфичные поля
                    </h2>
                    
                    <div>
                      <label className="block text-sm text-red-300 mb-1">Название для Яндекс</label>
                      <input
                        type="text"
                        value={marketplaceData.yandex.name}
                        onChange={(e) => handleMarketplaceDataChange('yandex', 'name', e.target.value)}
                        placeholder={product.name}
                        className="w-full px-3 py-2 bg-mm-dark border border-red-500/50 rounded text-mm-text focus:border-red-400 outline-none"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-red-300 mb-1">Описание для Яндекс</label>
                      <textarea
                        value={marketplaceData.yandex.description}
                        onChange={(e) => handleMarketplaceDataChange('yandex', 'description', e.target.value)}
                        placeholder={product.description}
                        rows="3"
                        className="w-full px-3 py-2 bg-mm-dark border border-red-500/50 rounded text-mm-text focus:border-red-400 outline-none resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Другие вкладки (сокращенно) */}
          {activeTab === 'prices' && (
            <div className="bg-mm-secondary p-6 rounded-lg">
              <h2 className="text-xl font-bold text-mm-text mb-6">ЦЕНЫ</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary">Цена со скидкой</p>
                  <p className="text-2xl font-bold text-mm-cyan">{(product.price_with_discount / 100).toFixed(2)} ₽</p>
                </div>
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary">Цена без скидки</p>
                  <p className="text-2xl font-bold text-mm-text">{(product.price_without_discount / 100).toFixed(2)} ₽</p>
                </div>
                <div className="p-4 bg-mm-dark rounded-lg">
                  <p className="text-xs text-mm-text-secondary">Себестоимость</p>
                  <p className="text-2xl font-bold text-mm-text">{(product.cost_price / 100).toFixed(2)} ₽</p>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'card' && activeTab !== 'prices' && (
            <div className="bg-mm-secondary p-6 rounded-lg text-center py-12">
              <p className="text-mm-text-secondary">Раздел "{activeTab}" в разработке</p>
            </div>
          )}
        </form>
      </div>

      {/* Bottom Save Bar - КАК В SELSUP */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-300 p-4 shadow-lg z-30">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-8 py-3 bg-cyan-500 text-white hover:bg-cyan-600 rounded font-bold disabled:opacity-50"
          >
            СОХРАНИТЬ
          </button>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700 font-medium">Отправить в:</span>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMarketplaces.honest_sign}
                onChange={(e) => setSelectedMarketplaces({ ...selectedMarketplaces, honest_sign: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="text-sm text-gray-700">Честный знак</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMarketplaces.ozon}
                onChange={(e) => setSelectedMarketplaces({ ...selectedMarketplaces, ozon: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">O</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMarketplaces.wb}
                onChange={(e) => setSelectedMarketplaces({ ...selectedMarketplaces, wb: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="w-7 h-7 bg-purple-600 text-white rounded flex items-center justify-center text-xs font-bold">WB</span>
            </label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMarketplaces.yandex}
                onChange={(e) => setSelectedMarketplaces({ ...selectedMarketplaces, yandex: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="w-7 h-7 bg-red-500 text-white rounded flex items-center justify-center text-xs font-bold">Я</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
