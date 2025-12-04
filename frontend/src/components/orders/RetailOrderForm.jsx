import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { FiX, FiPlus, FiTrash2 } from 'react-icons/fi'
import { toast } from 'sonner'

function RetailOrderForm({ onCancel, onSuccess }) {
  const { api } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0], // Добавлено поле даты
    customer: {
      full_name: '',
      phone: '',
      email: '',
      address: ''
    },
    items: [],
    payment_method: 'cash',
    notes: ''
  })

  const [productSearch, setProductSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])

  useEffect(() => {
    loadWarehouses()
    loadProducts()
  }, [])

  const loadWarehouses = async () => {
    try {
      const response = await api.get('/api/warehouses')
      setWarehouses(response.data)
    } catch (error) {
      console.error('Failed to load warehouses:', error)
      toast.error('Ошибка загрузки складов')
    }
  }

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/catalog/products?limit=1000')
      setProducts(response.data.products || [])
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const handleSearchProduct = (query) => {
    setProductSearch(query)
    if (!query) {
      setSearchResults([])
      return
    }
    
    const filtered = products.filter(p => 
      p.article?.toLowerCase().includes(query.toLowerCase()) ||
      p.name?.toLowerCase().includes(query.toLowerCase())
    )
    setSearchResults(filtered.slice(0, 10))
  }

  const addProduct = (product) => {
    // Проверить что не добавлен
    if (formData.items.find(i => i.article === product.article)) {
      toast.warning('Товар уже добавлен')
      return
    }
    
    const newItem = {
      product_id: product.id,
      article: product.article,
      name: product.name,
      image: product.images?.[0] || null,
      price: product.price_with_discount / 100 || 0,
      quantity: 1,
      total: (product.price_with_discount / 100 || 0)
    }
    
    setFormData({
      ...formData,
      items: [...formData.items, newItem]
    })
    setProductSearch('')
    setSearchResults([])
  }

  const removeProduct = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items: newItems })
  }

  const updateQuantity = (index, quantity) => {
    const newItems = [...formData.items]
    newItems[index].quantity = parseInt(quantity) || 1
    newItems[index].total = newItems[index].price * newItems[index].quantity
    setFormData({ ...formData, items: newItems })
  }

  const updatePrice = (index, price) => {
    const newItems = [...formData.items]
    newItems[index].price = parseFloat(price) || 0
    newItems[index].total = newItems[index].price * newItems[index].quantity
    setFormData({ ...formData, items: newItems })
  }

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.total, 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.warehouse_id) {
      toast.error('Выберите склад')
      return
    }
    
    if (formData.items.length === 0) {
      toast.error('Добавьте хотя бы один товар')
      return
    }
    
    if (!formData.customer.full_name || !formData.customer.phone) {
      toast.error('Заполните данные клиента')
      return
    }
    
    try {
      setLoading(true)
      await api.post('/api/orders/retail', formData)
      onSuccess()
    } catch (error) {
      console.error('Failed to create retail order:', error)
      toast.error(error.response?.data?.detail || 'Ошибка создания заказа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6" data-testid="retail-order-form">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-mono text-mm-green uppercase">Создание розничного заказа</h3>
        <button
          onClick={onCancel}
          className="btn-neon-sm"
          data-testid="cancel-form"
        >
          <FiX />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Дата и выбор склада */}
        <div className="card-neon p-4">
          <h4 className="text-sm font-mono text-mm-text-secondary mb-4 uppercase">Основная информация</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Дата заказа *</label>
              <input
                type="date"
                className="input-neon w-full"
                value={formData.order_date}
                onChange={(e) => setFormData({...formData, order_date: e.target.value})}
                required
                data-testid="order-date"
              />
            </div>
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Склад *</label>
              <select
                className="input-neon w-full"
                value={formData.warehouse_id}
                onChange={(e) => setFormData({...formData, warehouse_id: e.target.value})}
                required
                data-testid="select-warehouse"
              >
                <option value="">Выберите склад</option>
                {warehouses.map(wh => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Данные клиента */}
        <div className="card-neon p-4">
          <h4 className="text-sm font-mono text-mm-text-secondary mb-4 uppercase">Клиент</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Имя клиента *"
              className="input-neon"
              value={formData.customer.full_name}
              onChange={(e) => setFormData({
                ...formData,
                customer: {...formData.customer, full_name: e.target.value}
              })}
              required
              data-testid="customer-name"
            />
            <input
              type="tel"
              placeholder="Телефон *"
              className="input-neon"
              value={formData.customer.phone}
              onChange={(e) => setFormData({
                ...formData,
                customer: {...formData.customer, phone: e.target.value}
              })}
              required
              data-testid="customer-phone"
            />
            <input
              type="email"
              placeholder="Email"
              className="input-neon"
              value={formData.customer.email}
              onChange={(e) => setFormData({
                ...formData,
                customer: {...formData.customer, email: e.target.value}
              })}
              data-testid="customer-email"
            />
            <input
              type="text"
              placeholder="Адрес"
              className="input-neon"
              value={formData.customer.address}
              onChange={(e) => setFormData({
                ...formData,
                customer: {...formData.customer, address: e.target.value}
              })}
              data-testid="customer-address"
            />
          </div>
        </div>

        {/* Товары */}
        <div className="card-neon p-4">
          <h4 className="text-sm font-mono text-mm-text-secondary mb-4 uppercase">Товары</h4>
          
          {/* Поиск товара */}
          <div className="mb-4 relative">
            <input
              type="text"
              placeholder="Поиск товара по артикулу или названию..."
              className="input-neon w-full"
              value={productSearch}
              onChange={(e) => handleSearchProduct(e.target.value)}
              data-testid="product-search"
            />
            {searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-mm-gray border border-mm-border rounded max-h-60 overflow-y-auto">
                {searchResults.map(product => (
                  <div
                    key={product.id}
                    className="p-3 hover:bg-mm-cyan/10 cursor-pointer border-b border-mm-border last:border-b-0"
                    onClick={() => addProduct(product)}
                    data-testid={`search-result-${product.id}`}
                  >
                    <p className="font-mono text-sm text-mm-cyan">{product.article}</p>
                    <p className="font-mono text-xs text-mm-text-secondary">{product.name}</p>
                    <p className="font-mono text-xs text-mm-text-tertiary">{(product.price_with_discount / 100).toFixed(2)}₽</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Список добавленных товаров */}
          {formData.items.length === 0 ? (
            <p className="text-center text-mm-text-tertiary font-mono text-sm py-4">
              // Добавьте товары в заказ
            </p>
          ) : (
            <div className="space-y-2">
              {formData.items.map((item, index) => (
                <div key={index} className="flex items-center space-x-4 border border-mm-border rounded p-3" data-testid={`item-${index}`}>
                  <div className="flex-1">
                    <p className="font-mono text-sm text-mm-cyan">{item.article}</p>
                    <p className="font-mono text-xs text-mm-text-secondary">{item.name}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      className="input-neon w-20"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(index, e.target.value)}
                      data-testid={`quantity-${index}`}
                    />
                    <span className="font-mono text-sm text-mm-text-secondary">×</span>
                    <span className="font-mono text-sm w-24 text-right">{item.price.toFixed(2)}₽</span>
                    <span className="font-mono text-sm text-mm-green w-24 text-right">{item.total.toFixed(2)}₽</span>
                    <button
                      type="button"
                      onClick={() => removeProduct(index)}
                      className="text-mm-red hover:text-mm-red/80"
                      data-testid={`remove-${index}`}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-mm-border pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-sm text-mm-text-secondary uppercase">Итого:</span>
                  <span className="font-mono text-xl text-mm-green">{calculateTotal().toFixed(2)}₽</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Способ оплаты и примечания */}
        <div className="card-neon p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Способ оплаты</label>
              <select
                className="input-neon w-full"
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                data-testid="payment-method"
              >
                <option value="cash">Наличные</option>
                <option value="card">Карта</option>
                <option value="transfer">Перевод</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-mono text-mm-text-secondary mb-2">Примечания</label>
              <input
                type="text"
                className="input-neon w-full"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Дополнительная информация"
                data-testid="notes"
              />
            </div>
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="btn-neon-outline"
            disabled={loading}
          >
            Отмена
          </button>
          <button
            type="submit"
            className="btn-neon"
            disabled={loading || formData.items.length === 0}
            data-testid="submit-order"
          >
            {loading ? 'Создание...' : 'Создать заказ'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RetailOrderForm
