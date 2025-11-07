import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiTag, FiCheckCircle, FiXCircle } from 'react-icons/fi'

function AdminMarketingPage() {
  const { api } = useAuth()
  const [promocodes, setPromocodes] = useState([])
  const [loading, setLoading] = useState(true)

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

  const approvePromo = async (id) => {
    try {
      await api.put(`/api/admin/promocodes/${id}/approve`)
      alert('Promocode approved!')
      loadPromocodes()
    } catch (error) {
      alert('Failed to approve')
    }
  }

  const rejectPromo = async (id) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    
    try {
      await api.put(`/api/admin/promocodes/${id}/reject`, null, {
        params: { reason }
      })
      alert('Promocode rejected!')
      loadPromocodes()
    } catch (error) {
      alert('Failed to reject')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">MARKETING MODERATION</h2>
        <p className="comment">// Approve or reject seller promocodes</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : promocodes.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiTag className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No promocodes to moderate</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Seller</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Code</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Discount</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Expires</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
                {promocodes.map((promo) => (
                  <tr key={promo.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {promo.seller_id.substring(0, 8)}...
                    </td>
                    <td className="py-4 px-4 font-mono text-lg text-mm-cyan">{promo.code}</td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {promo.discount_type === 'percent' ? `${promo.discount_value}%` : `₽${promo.discount_value}`}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {promo.expires_at ? new Date(promo.expires_at).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="py-4 px-4">
                      <span className={
                        promo.status === 'active' ? 'status-active' :
                        promo.status === 'pending_approval' ? 'status-pending' :
                        'status-error'
                      }>
                        {promo.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      {promo.status === 'pending_approval' && (
                        <>
                          <button
                            onClick={() => approvePromo(promo.id)}
                            className="px-3 py-1 border border-mm-green text-mm-green hover:bg-mm-green/10 text-xs uppercase font-mono"
                            data-testid={`approve-promo-${promo.id}`}
                          >
                            <FiCheckCircle className="inline mr-1" />
                            APPROVE
                          </button>
                          <button
                            onClick={() => rejectPromo(promo.id)}
                            className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
                            data-testid={`reject-promo-${promo.id}`}
                          >
                            <FiXCircle className="inline mr-1" />
                            REJECT
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminMarketingPage
