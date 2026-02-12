import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiRotateCcw, FiCheckCircle, FiXCircle } from 'react-icons/fi'

function ReturnsPage() {
  const { api } = useAuth()
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReturns()
  }, [])

  const loadReturns = async () => {
    try {
      const response = await api.get('/api/returns')
      setReturns(response.data)
    } catch (error) {
      console.error('Failed to load returns:', error)
    }
    setLoading(false)
  }

  const acceptReturn = async (returnId) => {
    if (!confirm('Accept this return? Stock will be returned to warehouse.')) return
    
    try {
      // В реальности будет PUT /api/returns/{id}/accept
      alert('Return accepted! Stock returned to warehouse.')
      loadReturns()
    } catch (error) {
      alert('Failed to accept return')
    }
  }

  const rejectReturn = async (returnId) => {
    const reason = prompt('Reason for rejection:')
    if (!reason) return
    
    try {
      // В реальности будет PUT /api/returns/{id}/reject
      alert('Return rejected!')
      loadReturns()
    } catch (error) {
      alert('Failed to reject return')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">RETURNS</h2>
        <p className="comment">// Manage product returns</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : returns.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiRotateCcw className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No returns</p>
          <p className="comment">// Product returns will appear here</p>
        </div>
      ) : (
        <div className="card-neon overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-mm-border">
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Date</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Order #</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">SKU</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Reason</th>
                  <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Status</th>
                  <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm font-mono">Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((ret) => (
                  <tr key={ret.id} className="border-b border-mm-border hover:bg-mm-gray transition-colors">
                    <td className="py-4 px-4 font-mono text-sm text-mm-text-secondary">
                      {new Date(ret.dates?.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 font-mono text-sm text-mm-cyan">
                      {ret.order_id?.substring(0, 12)}...
                    </td>
                    <td className="py-4 px-4 font-mono text-sm">
                      {ret.items?.[0]?.sku || 'N/A'}
                    </td>
                    <td className="py-4 px-4 text-sm">{ret.reason}</td>
                    <td className="py-4 px-4">
                      <span className={
                        ret.status === 'accepted' ? 'status-active' :
                        ret.status === 'rejected' ? 'status-error' :
                        'status-pending'
                      }>
                        {ret.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      {ret.status === 'pending_review' && (
                        <>
                          <button
                            onClick={() => acceptReturn(ret.id)}
                            className="px-3 py-1 border border-mm-green text-mm-green hover:bg-mm-green/10 text-xs uppercase font-mono"
                          >
                            <FiCheckCircle className="inline mr-1" />
                            ACCEPT
                          </button>
                          <button
                            onClick={() => rejectReturn(ret.id)}
                            className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
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

export default ReturnsPage
