import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTag, FiCheckCircle, FiClock, FiXCircle } from 'react-icons/fi'

function PromocodesPage() {
  const { api } = useAuth()
  const [promocodes, setPromocodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newPromo, setNewPromo] = useState({
    code: '',
    discount_type: 'percent',
    discount_value: '',
    min_order_amount: '',
    max_uses: '',
    expires_at: ''
  })

  useEffect(() => {
    loadPromocodes()
  }, [])

  const loadPromocodes = async () => {
    try {
      const response = await api.get('/api/promocodes')
      setPromocodes(response.data)
    } catch (error) {
      console.error('Failed to load promocodes:', error)
    }
    setLoading(false)
  }

  const createPromocode = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/promocodes', newPromo)
      setShowCreateModal(false)
      setNewPromo({
        code: '',
        discount_type: 'percent',
        discount_value: '',
        min_order_amount: '',
        max_uses: '',
        expires_at: ''
      })
      loadPromocodes()
      alert('Promocode created! Waiting for admin approval.')
    } catch (error) {
      alert('Failed to create promocode')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'active': { class: 'status-active', icon: FiCheckCircle, text: 'ACTIVE' },
      'pending_approval': { class: 'status-pending', icon: FiClock, text: 'PENDING' },
      'expired': { class: 'status-error', icon: FiXCircle, text: 'EXPIRED' },
      'rejected': { class: 'status-error', icon: FiXCircle, text: 'REJECTED' }
    }
    return badges[status] || badges['pending_approval']
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">PROMOCODES</h2>
          <p className="comment">// Create and manage discount codes</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
          data-testid="create-promo-button"
        >
          ✨ CREATE PROMOCODE
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : promocodes.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiTag className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No promocodes yet</p>
          <p className="comment">// Click "CREATE PROMOCODE" to create your first discount code</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Code</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Discount</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Uses</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Expires</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                </tr>
              </thead>
              <tbody>
                {promocodes.map((promo) => {
                  const badge = getStatusBadge(promo.status)
                  const Icon = badge.icon
                  return (
                    <tr key={promo.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                      <td className="py-4 px-4 font-mono text-lg text-mm-cyan">{promo.code}</td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `₽${promo.discount_value}`}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm">
                        {promo.current_uses} / {promo.max_uses || '∞'}
                      </td>
                      <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                        {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-4 px-4">
                        <span className={badge.class}>
                          <Icon className="inline mr-1" />
                          {badge.text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">CREATE PROMOCODE</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-mm-text-secondary hover:text-mm-red">
                ✕
              </button>
            </div>

            <form onSubmit={createPromocode} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Code</label>
                  <input
                    type="text"
                    value={newPromo.code}
                    onChange={(e) => setNewPromo({...newPromo, code: e.target.value})}
                    className="input-neon w-full"
                    placeholder="SUMMER10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Type</label>
                  <select
                    value={newPromo.discount_type}
                    onChange={(e) => setNewPromo({...newPromo, discount_type: e.target.value})}
                    className="input-neon w-full"
                  >
                    <option value="percent">Percent %</option>
                    <option value="fixed">Fixed Amount ₽</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Discount Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPromo.discount_value}
                    onChange={(e) => setNewPromo({...newPromo, discount_value: e.target.value})}
                    className="input-neon w-full"
                    placeholder="10"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Expires At</label>
                  <input
                    type="date"
                    value={newPromo.expires_at}
                    onChange={(e) => setNewPromo({...newPromo, expires_at: e.target.value})}
                    className="input-neon w-full"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">CREATE</button>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PromocodesPage