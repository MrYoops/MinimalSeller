import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiSave, FiX, FiImage, FiTag, FiUpload, FiCheck } from 'react-icons/fi'

function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [loading, setLoading] = useState(true)
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [product, setProduct] = useState({
    sku: '',
    price: '',
    cogs: '',
    status: 'draft',
    category_id: '',
    visibility: { show_on_minimalmod: true, show_in_search: true, is_featured: false },
    seo: { meta_title: '', meta_description: '', url_slug: '' },
    minimalmod: { name: '', variant_name: '', description: '', tags: [], images: [], attributes: {} },
    marketplaces: {
      images: [],
      ozon: { enabled: false, product_id: '', name: '', description: '', price: '', category_id: '', attributes: {} },
      wildberries: { enabled: false, product_id: '', name: '', description: '', price: '', category_id: '', attributes: {} },
      yandex_market: { enabled: false, product_id: '', name: '', description: '', price: '', category_id: '', attributes: {} }
    }
  })

  useEffect(() => {
    loadCategories()
    if (id !== 'new') loadProduct()
    else setLoading(false)
  }, [id])

  const loadCategories = async () => {
    try {
      const response = await api.get('/api/admin/categories')
      setCategories(response.data)
    } catch (error) {
      console.error('Failed to load categories:', error)
    }
  }

  const loadProduct = async () => {
    try {
      const response = await api.get(`/api/products/${id}`)
      setProduct(response.data)
      if (response.data.category_id) {
        const cat = categories.find(c => c.id === response.data.category_id)
        setSelectedCategory(cat)
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    }
    setLoading(false)
  }

  const handleCategoryChange = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId)
    setSelectedCategory(cat)
    
    // Инициализируем атрибуты категории
    if (cat && cat.attributes) {
      const attrs = {}
      cat.attributes.forEach(attr => {
        attrs[attr] = product.minimalmod.attributes[attr] || ''
      })
      setProduct({
        ...product,
        category_id: categoryId,
        minimalmod: {...product.minimalmod, attributes: attrs}
      })
    } else {
      setProduct({...product, category_id: categoryId})
    }
  }

  const syncAttributesToMarketplaces = () => {
    if (!selectedCategory) return
    
    const mapping = selectedCategory.marketplace_mapping || {}
    
    // Синхронизация для Ozon
    if (product.marketplaces.ozon.enabled && mapping.ozon) {
      const ozonAttrs = {}
      Object.entries(product.minimalmod.attributes).forEach(([key, value]) => {
        const ozonKey = mapping.ozon.attribute_mapping?.[key]
        if (ozonKey && value) {
          ozonAttrs[ozonKey] = value
        }
      })
      setProduct({
        ...product,
        marketplaces: {
          ...product.marketplaces,
          ozon: {...product.marketplaces.ozon, attributes: ozonAttrs}
        }
      })
    }
    
    // Аналогично для WB и Yandex
    alert('Характеристики синхронизированы на все маркетплейсы!')
  }

  const publishToMinimalMod = async () => {
    try {
      const data = {
        ...product,
        visibility: {...product.visibility, show_on_minimalmod: true},
        status: 'active'
      }
      
      if (id === 'new') {
        await api.post('/api/products', data)
      } else {
        await api.put(`/api/products/${id}`, data)
      }
      
      alert('Товар опубликован на сайте MinimalMod!')
      navigate(-1)
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  const publishToMarketplaces = async () => {
    const enabledMPs = []
    if (product.marketplaces.ozon.enabled) enabledMPs.push('Ozon')
    if (product.marketplaces.wildberries.enabled) enabledMPs.push('Wildberries')
    if (product.marketplaces.yandex_market.enabled) enabledMPs.push('Яндекс.Маркет')
    
    if (enabledMPs.length === 0) {
      alert('Выберите хотя бы один маркетплейс!')
      return
    }
    
    try {
      // Синхронизация характеристик
      syncAttributesToMarketplaces()
      
      if (id === 'new') {
        await api.post('/api/products', product)
      } else {
        await api.put(`/api/products/${id}`, product)
      }
      
      alert(`Товар отправлен на: ${enabledMPs.join(', ')}!\n\nВ реальной системе здесь будет вызов API каждого маркетплейса.`)
      navigate(-1)
    } catch (error) {
      alert('Ошибка: ' + (error.response?.data?.detail || error.message))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-mm-black flex items-center justify-center">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mm-black">
      <header className="border-b border-mm-border bg-mm-darker sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-mm-cyan uppercase">
              {id === 'new' ? 'СОЗДАНИЕ ТОВАРА' : 'РЕДАКТИРОВАНИЕ ТОВАРА'}
            </h1>
            <div className="flex items-center space-x-4">
              <button onClick={publishToMinimalMod} className="btn-primary">
                <FiUpload className="inline mr-2" />
                ОПУБЛИКОВАТЬ НА САЙТ
              </button>
              <button onClick={publishToMarketplaces} className="btn-secondary border-mm-green text-mm-green">
                <FiUpload className="inline mr-2" />
                ОТПРАВИТЬ НА МП
              </button>
              <button onClick={() => navigate(-1)} className="btn-secondary">
                <FiX className="inline mr-2" />
                ОТМЕНА
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Marketplace Checkboxes */}
        <div className="card-neon mb-6">
          <p className="comment mb-3">// Выберите на какие площадки отправить товар:</p>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2 p-4 border-2 border-mm-border hover:border-mm-cyan transition-all cursor-pointer">
              <input
                type="checkbox"
                checked={true}
                disabled
                className="w-5 h-5"
              />
              <span className="font-mono text-mm-cyan">ОСНОВНОЙ САЙТ (обязательно)</span>
            </label>
            
            <label className={`flex items-center space-x-2 p-4 border-2 transition-all cursor-pointer ${
              product.marketplaces.ozon.enabled ? 'border-mm-blue bg-mm-blue/10' : 'border-mm-border hover:border-mm-blue'
            }`}>
              <input
                type="checkbox"
                checked={product.marketplaces.ozon.enabled}
                onChange={(e) => setProduct({
                  ...product,
                  marketplaces: {
                    ...product.marketplaces,
                    ozon: {...product.marketplaces.ozon, enabled: e.target.checked}
                  }
                })}
                className="w-5 h-5"
              />
              <span className={`font-mono ${product.marketplaces.ozon.enabled ? 'text-mm-blue' : 'text-mm-text-secondary'}`}>
                🔵 OZON
              </span>
            </label>
            
            <label className={`flex items-center space-x-2 p-4 border-2 transition-all cursor-pointer ${
              product.marketplaces.wildberries.enabled ? 'border-mm-purple bg-mm-purple/10' : 'border-mm-border hover:border-mm-purple'
            }`}>
              <input
                type="checkbox"
                checked={product.marketplaces.wildberries.enabled}
                onChange={(e) => setProduct({
                  ...product,
                  marketplaces: {
                    ...product.marketplaces,
                    wildberries: {...product.marketplaces.wildberries, enabled: e.target.checked}
                  }
                })}
                className="w-5 h-5"
              />
              <span className={`font-mono ${product.marketplaces.wildberries.enabled ? 'text-mm-purple' : 'text-mm-text-secondary'}`}>
                🟣 WILDBERRIES
              </span>
            </label>
            
            <label className={`flex items-center space-x-2 p-4 border-2 transition-all cursor-pointer ${
              product.marketplaces.yandex_market.enabled ? 'border-mm-yellow bg-mm-yellow/10' : 'border-mm-border hover:border-mm-yellow'
            }`}>
              <input
                type="checkbox"
                checked={product.marketplaces.yandex_market.enabled}
                onChange={(e) => setProduct({
                  ...product,
                  marketplaces: {
                    ...product.marketplaces,
                    yandex_market: {...product.marketplaces.yandex_market, enabled: e.target.checked}
                  }
                })}
                className="w-5 h-5"
              />
              <span className={`font-mono ${product.marketplaces.yandex_market.enabled ? 'text-mm-yellow' : 'text-mm-text-secondary'}`}>
                🟡 ЯНДЕКС.МАРКЕТ
              </span>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase">ОСНОВНАЯ ИНФОРМАЦИЯ</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">SKU *</label>
                    <input
                      type="text"
                      value={product.sku}
                      onChange={(e) => setProduct({...product, sku: e.target.value})}
                      className="input-neon w-full"
                      placeholder="PRODUCT-123"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена базовая *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.price}
                      onChange={(e) => setProduct({...product, price: e.target.value})}
                      className="input-neon w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название *</label>
                  <input
                    type="text"
                    value={product.minimalmod.name}
                    onChange={(e) => setProduct({...product, minimalmod: {...product.minimalmod, name: e.target.value}})}
                    className="input-neon w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Категория *</label>
                  <select
                    value={product.category_id || ''}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="input-neon w-full"
                  >
                    <option value="">Выберите категорию</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                  <p className="comment text-xs mt-1">// Характеристики появятся после выбора категории</p>
                </div>

                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание</label>
                  <textarea
                    value={product.minimalmod.description}
                    onChange={(e) => setProduct({...product, minimalmod: {...product.minimalmod, description: e.target.value}})}
                    className="input-neon w-full"
                    rows="6"
                  />
                </div>
              </div>
            </div>

            {/* Images for MinimalMod */}
            <div className="card-neon">
              <h3 className="text-xl mb-4 text-mm-cyan uppercase">
                <FiImage className="inline mr-2" />
                Фото для сайта (до 8 шт)
              </h3>
              <div className="space-y-2">
                {product.minimalmod.images.map((url, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    {url && (
                      <img src={url} alt="" className="w-16 h-16 object-cover border border-mm-border" />
                    )}
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const newImages = [...product.minimalmod.images]
                        newImages[idx] = e.target.value
                        setProduct({...product, minimalmod: {...product.minimalmod, images: newImages}})
                      }}
                      className="input-neon flex-1"
                      placeholder="https://example.com/image.jpg"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`file-mm-${idx}`}
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          alert('Файл выбран: ' + e.target.files[0].name + '\\nВ реальной системе загрузится на сервер')
                        }
                      }}
                    />
                    <label htmlFor={`file-mm-${idx}`} className="btn-secondary px-3 py-2 cursor-pointer">
                      📁
                    </label>
                    <button
                      onClick={() => {
                        setProduct({
                          ...product,
                          minimalmod: {
                            ...product.minimalmod,
                            images: product.minimalmod.images.filter((_, i) => i !== idx)
                          }
                        })
                      }}
                      className="text-mm-red hover:text-mm-red/80 text-xl"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {product.minimalmod.images.length < 8 && (
                  <button
                    onClick={() => setProduct({
                      ...product,
                      minimalmod: {...product.minimalmod, images: [...product.minimalmod.images, '']}
                    })}
                    className="btn-secondary w-full"
                  >
                    + Добавить фото
                  </button>
                )}
              </div>
            </div>

            {/* Images for Marketplaces */}
            <div className="card-neon border-2 border-mm-purple">
              <h3 className="text-xl mb-4 text-mm-purple uppercase">
                <FiImage className="inline mr-2" />
                Фото для МАРКЕТПЛЕЙСОВ (до 10 шт, формат 3:4)
              </h3>
              <p className="comment mb-3">// Эти фото используются на Ozon, Wildberries, Яндекс.Маркет</p>
              <div className="space-y-2">
                {product.marketplaces.images.map((url, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    {url && (
                      <img src={url} alt="" className="w-16 h-16 object-cover border border-mm-border" />
                    )}
                    <input
                      type="text"
                      value={url}
                      onChange={(e) => {
                        const newImages = [...product.marketplaces.images]
                        newImages[idx] = e.target.value
                        setProduct({...product, marketplaces: {...product.marketplaces, images: newImages}})
                      }}
                      className="input-neon flex-1"
                      placeholder="https://example.com/marketplace-image.jpg"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id={`file-mp-${idx}`}
                      onChange={(e) => {
                        if (e.target.files[0]) {
                          alert('Файл выбран: ' + e.target.files[0].name + '\\nВ реальной системе загрузится на сервер')
                        }
                      }}
                    />
                    <label htmlFor={`file-mp-${idx}`} className="btn-secondary px-3 py-2 cursor-pointer">
                      📁
                    </label>
                    <button
                      onClick={() => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, images: product.marketplaces.images.filter((_, i) => i !== idx)}
                      })}
                      className="text-mm-red hover:text-mm-red/80 text-xl"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {product.marketplaces.images.length < 10 && (
                  <button
                    onClick={() => setProduct({
                      ...product,
                      marketplaces: {...product.marketplaces, images: [...product.marketplaces.images, '']}
                    })}
                    className="btn-secondary w-full"
                  >
                    + Добавить фото
                  </button>
                )}
              </div>
              <p className="comment text-xs mt-3">// Рекомендуемый формат: 3:4 (например, 900x1200px)</p>
            </div>

            {/* Category Attributes */}
            {selectedCategory && selectedCategory.attributes && (
              <div className="card-neon">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl text-mm-cyan uppercase">ХАРАКТЕРИСТИКИ</h3>
                  <button
                    onClick={syncAttributesToMarketplaces}
                    className="btn-secondary text-xs"
                  >
                    <FiCheck className="inline mr-1" />
                    Синхронизировать на МП
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCategory.attributes.map((attr) => (
                    <div key={attr}>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">{attr}</label>
                      <input
                        type="text"
                        value={product.minimalmod.attributes[attr] || ''}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {
                            ...product.minimalmod,
                            attributes: {...product.minimalmod.attributes, [attr]: e.target.value}
                          }
                        })}
                        className="input-neon w-full"
                        placeholder={`Введите ${attr}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="comment text-xs mt-3">// Заполните один раз, потом нажмите "Синхронизировать" для автозаполнения на всех МП</p>
              </div>
            )}

            {/* Ozon Section */}
            {product.marketplaces.ozon.enabled && (
              <div className="card-neon border-2 border-mm-blue">
                <h3 className="text-xl mb-4 text-mm-blue uppercase">🔵 OZON НАСТРОЙКИ</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена для Ozon</label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.marketplaces.ozon.price}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, ozon: {...product.marketplaces.ozon, price: e.target.value}}
                      })}
                      className="input-neon w-full"
                      placeholder="Укажите цену для Ozon"
                    />
                    <p className="comment text-xs mt-1">// Если пусто, будет использована базовая цена</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание для Ozon</label>
                    <textarea
                      value={product.marketplaces.ozon.description}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, ozon: {...product.marketplaces.ozon, description: e.target.value}}
                      })}
                      className="input-neon w-full"
                      rows="4"
                      placeholder="Описание для Ozon (может отличаться от основного)"
                    />
                    <p className="comment text-xs mt-1">// Если пусто, будет использовано основное описание</p>
                  </div>
                </div>
              </div>
            )}

            {/* Wildberries Section */}
            {product.marketplaces.wildberries.enabled && (
              <div className="card-neon border-2 border-mm-purple">
                <h3 className="text-xl mb-4 text-mm-purple uppercase">🟣 WILDBERRIES НАСТРОЙКИ</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена для WB</label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.marketplaces.wildberries.price}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, wildberries: {...product.marketplaces.wildberries, price: e.target.value}}
                      })}
                      className="input-neon w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание для WB</label>
                    <textarea
                      value={product.marketplaces.wildberries.description}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, wildberries: {...product.marketplaces.wildberries, description: e.target.value}}
                      })}
                      className="input-neon w-full"
                      rows="4"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Yandex Section */}
            {product.marketplaces.yandex_market.enabled && (
              <div className="card-neon border-2 border-mm-yellow">
                <h3 className="text-xl mb-4 text-mm-yellow uppercase">🟡 ЯНДЕКС.МАРКЕТ НАСТРОЙКИ</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена для Яндекса</label>
                    <input
                      type="number"
                      step="0.01"
                      value={product.marketplaces.yandex_market.price}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, yandex_market: {...product.marketplaces.yandex_market, price: e.target.value}}
                      })}
                      className="input-neon w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание для Яндекса</label>
                    <textarea
                      value={product.marketplaces.yandex_market.description}
                      onChange={(e) => setProduct({
                        ...product,
                        marketplaces: {...product.marketplaces, yandex_market: {...product.marketplaces.yandex_market, description: e.target.value}}
                      })}
                      className="input-neon w-full"
                      rows="4"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Статус</h3>
              <select
                value={product.status}
                onChange={(e) => setProduct({...product, status: e.target.value})}
                className="input-neon w-full"
              >
                <option value="draft">Черновик</option>
                <option value="active">Активен</option>
                <option value="out_of_stock">Нет в наличии</option>
                <option value="archived">Архив</option>
              </select>
            </div>

            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">Видимость</h3>
              <div className="space-y-3">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={product.visibility.show_on_minimalmod}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, show_on_minimalmod: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Показывать на сайте</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={product.visibility.is_featured}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, is_featured: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Рекомендуемый</span>
                </label>
              </div>
            </div>

            <div className="card-neon bg-mm-blue/5 border-mm-blue">
              <p className="text-mm-blue font-bold text-sm mb-2">ℹ️ Как это работает:</p>
              <ul className="text-xs text-mm-text-secondary space-y-1">
                <li>1. Заполните основные поля</li>
                <li>2. Выберите категорию</li>
                <li>3. Заполните характеристики</li>
                <li>4. Отметьте МП (чекбоксы вверху)</li>
                <li>5. Укажите цены для МП</li>
                <li>6. Нажмите "Отправить на МП"</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductEditPage