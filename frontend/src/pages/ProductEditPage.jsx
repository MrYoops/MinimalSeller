import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { FiSave, FiX, FiImage, FiTag, FiPackage } from 'react-icons/fi'

function ProductEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeMarketplace, setActiveMarketplace] = useState('minimalmod')
  const [categories, setCategories] = useState([])
  const [product, setProduct] = useState({
    sku: '',
    price: '',
    cogs: '',
    status: 'draft',
    category_id: '',
    visibility: {
      show_on_minimalmod: true,
      show_in_search: true,
      is_featured: false
    },
    seo: {
      meta_title: '',
      meta_description: '',
      url_slug: ''
    },
    minimalmod: {
      name: '',
      variant_name: '',
      description: '',
      tags: [],
      images: [],
      attributes: {}
    },
    marketplaces: {
      images: [],
      ozon: {
        enabled: false,
        product_id: '',
        name: '',
        description: '',
        price: '',
        category_id: '',
        attributes: {}
      },
      wildberries: {
        enabled: false,
        product_id: '',
        name: '',
        description: '',
        price: '',
        category_id: '',
        attributes: {}
      },
      yandex_market: {
        enabled: false,
        product_id: '',
        name: '',
        description: '',
        price: '',
        category_id: '',
        attributes: {}
      }
    }
  })

  useEffect(() => {
    loadCategories()
    if (id !== 'new') {
      loadProduct()
    } else {
      setLoading(false)
    }
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
    } catch (error) {
      console.error('Failed to load product:', error)
      alert('Failed to load product')
    }
    setLoading(false)
  }

  const handleSave = async () => {
    try {
      if (id === 'new') {
        await api.post('/api/products', product)
        alert('Product created successfully!')
      } else {
        await api.put(`/api/products/${id}`, product)
        alert('Product updated successfully!')
      }
      navigate(-1)
    } catch (error) {
      console.error('Failed to save product:', error)
      alert('Failed to save: ' + (error.response?.data?.detail || error.message))
    }
  }

  const addTag = (tag) => {
    if (tag && !product.minimalmod.tags.includes(tag)) {
      setProduct({
        ...product,
        minimalmod: {
          ...product.minimalmod,
          tags: [...product.minimalmod.tags, tag]
        }
      })
    }
  }

  const removeTag = (tag) => {
    setProduct({
      ...product,
      minimalmod: {
        ...product.minimalmod,
        tags: product.minimalmod.tags.filter(t => t !== tag)
      }
    })
  }

  const addAttribute = (marketplace, key, value) => {
    if (marketplace === 'minimalmod') {
      setProduct({
        ...product,
        minimalmod: {
          ...product.minimalmod,
          attributes: {...product.minimalmod.attributes, [key]: value}
        }
      })
    } else {
      setProduct({
        ...product,
        marketplaces: {
          ...product.marketplaces,
          [marketplace]: {
            ...product.marketplaces[marketplace],
            attributes: {...product.marketplaces[marketplace].attributes, [key]: value}
          }
        }
      })
    }
  }

  const removeAttribute = (marketplace, key) => {
    if (marketplace === 'minimalmod') {
      const newAttrs = {...product.minimalmod.attributes}
      delete newAttrs[key]
      setProduct({
        ...product,
        minimalmod: {...product.minimalmod, attributes: newAttrs}
      })
    } else {
      const newAttrs = {...product.marketplaces[marketplace].attributes}
      delete newAttrs[key]
      setProduct({
        ...product,
        marketplaces: {
          ...product.marketplaces,
          [marketplace]: {
            ...product.marketplaces[marketplace],
            attributes: newAttrs
          }
        }
      })
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
      {/* Header */}
      <header className="border-b border-mm-border bg-mm-darker sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold text-mm-cyan uppercase">
              {id === 'new' ? 'CREATE PRODUCT' : 'EDIT PRODUCT'}
            </h1>
            <div className="flex items-center space-x-4">
              <button onClick={handleSave} className="btn-primary">
                <FiSave className="inline mr-2" />
                SAVE PRODUCT
              </button>
              <button onClick={() => navigate(-1)} className="btn-secondary">
                <FiX className="inline mr-2" />
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Marketplace Switcher */}
        <div className="mb-6">
          <p className="comment mb-3">// Select where to publish this product:</p>
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveMarketplace('minimalmod')}
              className={`px-6 py-3 border-2 font-mono uppercase transition-all ${
                activeMarketplace === 'minimalmod'
                  ? 'border-mm-purple text-mm-purple bg-mm-purple/10'
                  : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
              }`}
            >
              <FiPackage className="inline mr-2" />
              ОСНОВНОЙ САЙТ
            </button>
            <button
              onClick={() => setActiveMarketplace('ozon')}
              className={`px-6 py-3 border-2 font-mono uppercase transition-all ${
                activeMarketplace === 'ozon'
                  ? 'border-mm-blue text-mm-blue bg-mm-blue/10'
                  : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
              }`}
            >
              OZON
            </button>
            <button
              onClick={() => setActiveMarketplace('wildberries')}
              className={`px-6 py-3 border-2 font-mono uppercase transition-all ${
                activeMarketplace === 'wildberries'
                  ? 'border-mm-purple text-mm-purple bg-mm-purple/10'
                  : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
              }`}
            >
              WILDBERRIES
            </button>
            <button
              onClick={() => setActiveMarketplace('yandex_market')}
              className={`px-6 py-3 border-2 font-mono uppercase transition-all ${
                activeMarketplace === 'yandex_market'
                  ? 'border-mm-yellow text-mm-yellow bg-mm-yellow/10'
                  : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
              }`}
            >
              ЯНДЕКС.МАРКЕТ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* MinimalMod Section */}
            {activeMarketplace === 'minimalmod' && (
              <>
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">ОСНОВНАЯ ИНФОРМАЦИЯ</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">SKU (Артикул) *</label>
                        <input
                          type="text"
                          value={product.sku}
                          onChange={(e) => setProduct({...product, sku: e.target.value})}
                          className="input-neon w-full"
                          placeholder="PRODUCT-NAME-db15"
                        />
                        <p className="comment text-xs mt-1">// Уникальный идентификатор товара</p>
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.price}
                          onChange={(e) => setProduct({...product, price: parseFloat(e.target.value)})}
                          className="input-neon w-full"
                          placeholder="1500.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название товара *</label>
                      <input
                        type="text"
                        value={product.minimalmod.name}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, name: e.target.value}
                        })}
                        className="input-neon w-full"
                        placeholder="Название товара"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Вариант</label>
                      <input
                        type="text"
                        value={product.minimalmod.variant_name}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, variant_name: e.target.value}
                        })}
                        className="input-neon w-full"
                        placeholder="Например: Красный, Размер M"
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание</label>
                      <textarea
                        value={product.minimalmod.description}
                        onChange={(e) => setProduct({
                          ...product,
                          minimalmod: {...product.minimalmod, description: e.target.value}
                        })}
                        className="input-neon w-full"
                        rows="8"
                        placeholder="Подробное описание товара для основного сайта..."
                      />
                      <p className="comment text-xs mt-1">// Описание для MinimalMod сайта</p>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Категория</label>
                      <select
                        value={product.category_id || ''}
                        onChange={(e) => setProduct({...product, category_id: e.target.value})}
                        className="input-neon w-full"
                      >
                        <option value="">Выберите категорию</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Себестоимость (COGS)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={product.cogs || ''}
                        onChange={(e) => setProduct({...product, cogs: parseFloat(e.target.value)})}
                        className="input-neon w-full"
                        placeholder="800.00"
                      />
                      <p className="comment text-xs mt-1">// Для расчета прибыли в финансовой аналитике</p>
                    </div>
                  </div>
                </div>

                {/* Images for MinimalMod */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">
                    <FiImage className="inline mr-2" />
                    Изображения для MinimalMod (до 8 фото)
                  </h3>
                  <div className="space-y-2">
                    {product.minimalmod.images.map((url, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            const newImages = [...product.minimalmod.images]
                            newImages[idx] = e.target.value
                            setProduct({
                              ...product,
                              minimalmod: {...product.minimalmod, images: newImages}
                            })
                          }}
                          className="input-neon flex-1"
                          placeholder="https://example.com/image.jpg"
                        />
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
                          className="text-mm-red hover:text-mm-red/80"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {product.minimalmod.images.length < 8 && (
                      <button
                        onClick={() => {
                          setProduct({
                            ...product,
                            minimalmod: {
                              ...product.minimalmod,
                              images: [...product.minimalmod.images, '']
                            }
                          })
                        }}
                        className="btn-secondary w-full"
                      >
                        + Добавить изображение
                      </button>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">
                    <FiTag className="inline mr-2" />
                    Теги (не идут в название)
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {product.minimalmod.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 text-sm font-mono border border-mm-cyan text-mm-cyan flex items-center"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-2 text-mm-red hover:text-mm-red/80"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    className="input-neon w-full"
                    placeholder="Добавить тег и нажать Enter"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTag(e.target.value.trim())
                        e.target.value = ''
                      }
                    }}
                  />
                  <p className="comment text-xs mt-1">// Теги для поиска и фильтрации (например: летний, новинка, скидка)</p>
                </div>

                {/* Attributes */}
                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-cyan uppercase">Характеристики</h3>
                  <div className="space-y-2 mb-3">
                    {Object.entries(product.minimalmod.attributes).map(([key, value]) => (
                      <div key={key} className="flex items-center space-x-2">
                        <span className="input-neon flex-1">{key}</span>
                        <span className="text-mm-text-secondary">=</span>
                        <span className="input-neon flex-1">{value}</span>
                        <button
                          onClick={() => removeAttribute('minimalmod', key)}
                          className="text-mm-red hover:text-mm-red/80"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      id="attr-key-mm"
                      className="input-neon flex-1"
                      placeholder="Ключ (Цвет)"
                    />
                    <span className="text-mm-text-secondary">=</span>
                    <input
                      type="text"
                      id="attr-value-mm"
                      className="input-neon flex-1"
                      placeholder="Значение (Черный)"
                    />
                    <button
                      onClick={() => {
                        const keyInput = document.getElementById('attr-key-mm')
                        const valueInput = document.getElementById('attr-value-mm')
                        if (keyInput.value && valueInput.value) {
                          addAttribute('minimalmod', keyInput.value, valueInput.value)
                          keyInput.value = ''
                          valueInput.value = ''
                        }
                      }}
                      className="btn-secondary px-3 py-2"
                    >
                      +
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Ozon Section */}
            {activeMarketplace === 'ozon' && (
              <>
                <div className="card-neon">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl text-mm-blue uppercase">OZON НАСТРОЙКИ</h3>
                    <label className="flex items-center space-x-2">
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
                        className="w-4 h-4"
                      />
                      <span className="text-mm-text-secondary">Публиковать на Ozon</span>
                    </label>
                  </div>

                  {product.marketplaces.ozon.enabled && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Product ID на Ozon</label>
                        <input
                          type="text"
                          value={product.marketplaces.ozon.product_id}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, product_id: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                          placeholder="123456789"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Название для Ozon</label>
                        <input
                          type="text"
                          value={product.marketplaces.ozon.name}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, name: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Описание для Ozon</label>
                        <textarea
                          value={product.marketplaces.ozon.description}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, description: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                          rows="6"
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Цена для Ozon</label>
                        <input
                          type="number"
                          step="0.01"
                          value={product.marketplaces.ozon.price}
                          onChange={(e) => setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              ozon: {...product.marketplaces.ozon, price: e.target.value}
                            }
                          })}
                          className="input-neon w-full"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="card-neon">
                  <h3 className="text-xl mb-4 text-mm-blue uppercase">Изображения для маркетплейсов (до 10 фото)</h3>
                  <p className="comment mb-3">// Общие изображения для всех маркетплейсов</p>
                  <div className="space-y-2">
                    {product.marketplaces.images.map((url, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={url}
                          onChange={(e) => {
                            const newImages = [...product.marketplaces.images]
                            newImages[idx] = e.target.value
                            setProduct({
                              ...product,
                              marketplaces: {...product.marketplaces, images: newImages}
                            })
                          }}
                          className="input-neon flex-1"
                        />
                        <button
                          onClick={() => {
                            setProduct({
                              ...product,
                              marketplaces: {
                                ...product.marketplaces,
                                images: product.marketplaces.images.filter((_, i) => i !== idx)
                              }
                            })
                          }}
                          className="text-mm-red"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {product.marketplaces.images.length < 10 && (
                      <button
                        onClick={() => {
                          setProduct({
                            ...product,
                            marketplaces: {
                              ...product.marketplaces,
                              images: [...product.marketplaces.images, '']
                            }
                          })
                        }}
                        className="btn-secondary w-full"
                      >
                        + Добавить изображение
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Similar sections for WB and Yandex */}
            {(activeMarketplace === 'wildberries' || activeMarketplace === 'yandex_market') && (
              <div className="card-neon text-center py-12">
                <FiPackage className="mx-auto text-mm-text-tertiary mb-4" size={48} />
                <p className="text-mm-text-secondary mb-2">Настройки для {activeMarketplace}</p>
                <p className="comment">// Аналогично Ozon (будет реализовано)</p>
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
                    checked={product.visibility.show_in_search}
                    onChange={(e) => setProduct({
                      ...product,
                      visibility: {...product.visibility, show_in_search: e.target.checked}
                    })}
                    className="w-4 h-4"
                  />
                  <span className="text-mm-text-secondary">Показывать в поиске</span>
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
                  <span className="text-mm-text-secondary">Рекомендуемый товар</span>
                </label>
              </div>
            </div>

            <div className="card-neon">
              <h3 className="text-lg mb-4 text-mm-cyan uppercase">SEO</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Meta Title</label>
                  <input
                    type="text"
                    value={product.seo.meta_title}
                    onChange={(e) => setProduct({
                      ...product,
                      seo: {...product.seo, meta_title: e.target.value}
                    })}
                    className="input-neon w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">URL Slug</label>
                  <input
                    type="text"
                    value={product.seo.url_slug}
                    onChange={(e) => setProduct({
                      ...product,
                      seo: {...product.seo, url_slug: e.target.value}
                    })}
                    className="input-neon w-full"
                  />
                  <p className="comment text-xs mt-1">// Автогенерация из названия</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductEditPage