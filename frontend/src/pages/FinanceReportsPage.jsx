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

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">UPLOAD FINANCE REPORT</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-mm-text-secondary hover:text-mm-red">✕</button>
            </div>

            <form onSubmit={uploadReport} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Marketplace</label>
                <select
                  value={uploadData.marketplace}
                  onChange={(e) => setUploadData({...uploadData, marketplace: e.target.value})}
                  className="input-neon w-full"
                >
                  <option value="ozon">Ozon - Отчет комиссионера</option>
                  <option value="wildberries">Wildberries - Отчет о продажах</option>
                  <option value="yandex">Yandex.Market - Финансовый отчет</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">File (Excel/CSV)</label>
                <div className="border-2 border-dashed border-mm-border p-8 text-center hover:border-mm-cyan transition-colors cursor-pointer">
                  <FiUpload className="mx-auto text-mm-text-tertiary mb-2" size={48} />
                  <p className="text-mm-text-secondary mb-2">Click to select file</p>
                  <p className="comment text-xs">// .xlsx, .xls, .csv</p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setUploadData({...uploadData, file: e.target.files[0]})}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="btn-secondary inline-block mt-3">SELECT FILE</span>
                  </label>
                  {uploadData.file && (
                    <p className="text-mm-green mt-3">✓ {uploadData.file.name}</p>
                  )}
                </div>
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1" disabled={!uploadData.file}>
                  UPLOAD & PARSE
                </button>
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary flex-1">
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

export default FinanceReportsPage