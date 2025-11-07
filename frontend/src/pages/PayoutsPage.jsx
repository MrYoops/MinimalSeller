import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDollarSign, FiCheckCircle, FiXCircle, FiClock } from 'react-icons/fi'

function PayoutsPage({ isAdmin = false }) {
  const { api } = useAuth()
  const [payouts, setPayouts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [amount, setAmount] = useState('')

  useEffect(() => {
    loadPayouts()
  }, [])

  const loadPayouts = async () => {
    try {
      const response = await api.get('/api/payouts')
      setPayouts(response.data)
    } catch (error) {
      console.error('Failed to load payouts:', error)
    }
    setLoading(false)
  }

  const requestPayout = async (e) => {
    e.preventDefault()
    try {
      await api.post('/api/payouts/request', null, {
        params: { amount: parseFloat(amount) }
      })
      setShowRequestModal(false)
      setAmount('')
      loadPayouts()
      alert('Payout request submitted!')
    } catch (error) {
      alert('Failed to request payout')
    }
  }

  const approvePayout = async (id) => {
    try {
      await api.put(`/api/admin/payouts/${id}/approve`)
      loadPayouts()
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const markPaid = async (id) => {
    try {
      await api.put(`/api/admin/payouts/${id}/paid`)
      loadPayouts()
    } catch (error) {
      console.error('Failed to mark paid:', error)
    }
  }

  const rejectPayout = async (id) => {
    try {
      await api.put(`/api/admin/payouts/${id}/reject`)
      loadPayouts()
    } catch (error) {
      console.error('Failed to reject:', error)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      'pending': { class: 'status-pending', icon: FiClock, text: 'PENDING' },
      'approved': { class: 'status-new', icon: FiCheckCircle, text: 'APPROVED' },
      'paid': { class: 'status-active', icon: FiCheckCircle, text: 'PAID' },
      'rejected': { class: 'status-error', icon: FiXCircle, text: 'REJECTED' }
    }
    return badges[status] || badges['pending']
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase">
            {isAdmin ? 'PAYOUT REQUESTS' : 'BALANCE & PAYOUTS'}
          </h2>
          <p className="comment">
            {isAdmin ? '// Manage seller payout requests' : '// Request withdrawals'}
          </p>
        </div>
        {!isAdmin && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="btn-primary"
            data-testid="request-payout-button"
          >
            💸 REQUEST PAYOUT
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : payouts.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiDollarSign className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No payout requests</p>
          <p className="comment">// {isAdmin ? 'Requests will appear here' : 'Click "REQUEST PAYOUT" to withdraw funds'}</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Date</th>
                  {isAdmin && <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Seller</th>}
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Amount</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                  {isAdmin && <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => {
                  const badge = getStatusBadge(payout.status)
                  const Icon = badge.icon
                  return (
                    <tr key={payout.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                      <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && (
                        <td className="py-4 px-4 font-mono text-sm">
                          {payout.seller_id.substring(0, 8)}...
                        </td>
                      )}
                      <td className="py-4 px-4 font-mono text-lg text-mm-green">
                        ₽{payout.amount.toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <span className={badge.class}>
                          <Icon className="inline mr-1" />
                          {badge.text}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-4 px-4 text-right space-x-2">
                          {payout.status === 'pending' && (
                            <>
                              <button
                                onClick={() => approvePayout(payout.id)}
                                className="px-3 py-1 border border-mm-green text-mm-green hover:bg-mm-green/10 text-xs uppercase font-mono"
                              >
                                APPROVE
                              </button>
                              <button
                                onClick={() => rejectPayout(payout.id)}
                                className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
                              >
                                REJECT
                              </button>
                            </>
                          )}
                          {payout.status === 'approved' && (
                            <button
                              onClick={() => markPaid(payout.id)}
                              className="px-3 py-1 border border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 text-xs uppercase font-mono"
                            >
                              MARK AS PAID
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request Payout Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">REQUEST PAYOUT</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-mm-text-secondary hover:text-mm-red transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={requestPayout} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="input-neon w-full"
                  placeholder="10000.00"
                  required
                />
                <p className="comment text-xs mt-1">// Enter amount in RUB</p>
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">
                  REQUEST
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  className="btn-secondary flex-1"
                >
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

export default PayoutsPage