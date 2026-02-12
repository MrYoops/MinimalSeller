import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from '../i18n/translations'

function FinanceDashboard() {
  const { api } = useAuth()
  const { language } = useTheme()
  const { t } = useTranslation(language)
  const [metrics, setMetrics] = useState({
    revenue: 0,
    costs: 0,
    cogs: 0,
    gross_profit: 0,
    net_profit: 0,
    margin: 0,
    transactions_count: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    try {
      const response = await api.get('/api/finance/dashboard')
      setMetrics(response.data)
    } catch (error) {
      console.error('Failed to load finance dashboard:', error)
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-mm-cyan animate-pulse">// LOADING...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">FINANCIAL DASHBOARD</h2>
        <p className="comment">// Your financial overview</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-neon">
          <p className="comment mb-2">// Revenue</p>
          <p className="text-4xl font-bold text-mm-green flex items-center">
            <FiTrendingUp className="mr-2" />
            ₽{metrics.revenue.toLocaleString()}
          </p>
        </div>
        
        <div className="card-neon">
          <p className="comment mb-2">// Costs</p>
          <p className="text-4xl font-bold text-mm-red flex items-center">
            <FiTrendingDown className="mr-2" />
            ₽{metrics.costs.toLocaleString()}
          </p>
        </div>
        
        <div className="card-neon">
          <p className="comment mb-2">// Net Profit</p>
          <p className={`text-4xl font-bold flex items-center ${
            metrics.net_profit >= 0 ? 'text-mm-green' : 'text-mm-red'
          }`}>
            <FiDollarSign className="mr-2" />
            ₽{metrics.net_profit.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card-neon">
          <p className="comment mb-2">// COGS (Cost of Goods)</p>
          <p className="text-2xl font-bold text-mm-yellow">₽{metrics.cogs.toLocaleString()}</p>
        </div>
        
        <div className="card-neon">
          <p className="comment mb-2">// Gross Profit</p>
          <p className="text-2xl font-bold text-mm-cyan">₽{metrics.gross_profit.toLocaleString()}</p>
        </div>
        
        <div className="card-neon">
          <p className="comment mb-2">// Margin</p>
          <p className="text-2xl font-bold text-mm-purple">{metrics.margin}%</p>
        </div>
      </div>

      {/* Profit Breakdown */}
      <div className="card-neon">
        <h3 className="text-xl mb-4 text-mm-cyan uppercase">PROFIT BREAKDOWN</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center py-2 border-b border-mm-border">
            <span className="font-mono text-mm-text-secondary">Revenue</span>
            <span className="font-mono text-mm-green">+ ₽{metrics.revenue.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-mm-border">
            <span className="font-mono text-mm-text-secondary">COGS</span>
            <span className="font-mono text-mm-red">- ₽{metrics.cogs.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-mm-border font-bold">
            <span className="font-mono">Gross Profit</span>
            <span className="font-mono text-mm-cyan">₽{metrics.gross_profit.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-mm-border">
            <span className="font-mono text-mm-text-secondary">Operating Costs</span>
            <span className="font-mono text-mm-red">- ₽{metrics.costs.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center py-2 font-bold text-lg">
            <span className="font-mono">Net Profit</span>
            <span className={`font-mono ${
              metrics.net_profit >= 0 ? 'text-mm-green' : 'text-mm-red'
            }`}>
              ₽{metrics.net_profit.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="card-neon">
        <p className="comment">// Transactions processed: {metrics.transactions_count}</p>
      </div>
    </div>
  )
}

export default FinanceDashboard