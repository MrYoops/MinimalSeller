import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiPercent, FiCalendar } from 'react-icons/fi'

function PromotionsPage() {
  const { api } = useAuth()
  const [promotions, setPromotions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showParticipateModal, setShowParticipateModal] = useState(false)
  const [selectedPromotion, setSelectedPromotion] = useState(null)
  const [participationData, setParticipationData] = useState({
    product_ids: [],
    discount: ''
  })
  const [products, setProducts] = useState([])

  useEffect(() => {
    loadPromotions()
    loadProducts()
  }, [])

  const loadPromotions = async () => {
    try {
      const response = await api.get('/api/promotions')
      setPromotions(response.data)
    } catch (error) {
      console.error('Failed to load promotions:', error)
    }
    setLoading(false)
  }

  const loadProducts = async () => {
    try {
      const response = await api.get('/api/products')
      setProducts(response.data)
    } catch (error) {
      console.error('Failed to load products:', error)
    }
  }

  const participate = async (e) => {
    e.preventDefault()
    
    try {
      await api.post(`/api/promotions/${selectedPromotion.id}/participate`, participationData)
      alert('Заявка на участие отправлена! Ожидайте одобрения администратора.')
      setShowParticipateModal(false)
      setParticipationData({ product_ids: [], discount: '' })
    } catch (error) {
      alert('Failed to participate')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">SALES & PROMOTIONS</h2>
        <p className="comment">// Participate in platform-wide promotions</p>
      </div>

      {/* Info */}
      <div className="card-neon bg-mm-yellow/5 border-mm-yellow">
        <p className="text-mm-yellow font-bold mb-2">ℹ️ Глобальные акции платформы</p>
        <p className="text-sm text-mm-text-secondary">
          Администратор создает акции (Черная Пятница, Летняя распродажа и т.д.).
          Вы можете подать заявку на участие, выбрав товары и указав скидку.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : promotions.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiPercent className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No active promotions</p>
          <p className="comment">// Admin will create platform promotions</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {promotions.map((promo) => (
            <div key={promo.id} className="card-neon">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl text-mm-cyan">{promo.name || 'Summer Sale'}</h3>
                <span className="status-active">ACTIVE</span>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center space-x-2">
                  <FiCalendar className="text-mm-text-secondary" />
                  <span className="text-sm text-mm-text-secondary">
                    {new Date(promo.start_date || Date.now()).toLocaleDateString()} - {new Date(promo.end_date || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-mm-text-secondary">{promo.description || 'Platform-wide promotion event'}</p>
              </div>

              <button
                onClick={() => {
                  setSelectedPromotion(promo)
                  setShowParticipateModal(true)
                }}
                className="btn-primary w-full"
              >
                PARTICIPATE
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Participate Modal */}
      {showParticipateModal && selectedPromotion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">PARTICIPATE IN: {selectedPromotion.name}</h3>
              <button onClick={() => setShowParticipateModal(false)} className="text-mm-text-secondary hover:text-mm-red">✕</button>
            </div>

            <form onSubmit={participate} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Select Products</label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center space-x-2 p-2 border border-mm-border hover:border-mm-cyan">
                      <input
                        type="checkbox"
                        checked={participationData.product_ids.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setParticipationData({
                              ...participationData,
                              product_ids: [...participationData.product_ids, product.id]
                            })
                          } else {
                            setParticipationData({
                              ...participationData,
                              product_ids: participationData.product_ids.filter(id => id !== product.id)
                            })
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{product.sku} - {product.minimalmod.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Your Discount (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={participationData.discount}
                  onChange={(e) => setParticipationData({...participationData, discount: e.target.value})}
                  className="input-neon w-full"
                  placeholder="10"
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">
                  SUBMIT APPLICATION
                </button>
                <button type="button" onClick={() => setShowParticipateModal(false)} className="btn-secondary flex-1">
                  CANCEL
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PromotionsPage