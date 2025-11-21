import React, { useState, useEffect } from 'react'
import { FiDownload, FiRefreshCw, FiCheck, FiAlertCircle } from 'react-icons/fi'
import { useAuth } from '../context/AuthContext'

export default function AdminCategoriesPage() {
  const { api } = useAuth()
  const [loading, setLoading] = useState({})
  const [status, setStatus] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    loadStatus()
  }, [])

  const loadStatus = async () => {
    try {
      const response = await api.get('/api/admin/categories/preload/status')
      setStatus(response.data)
    } catch (err) {
      console.error('Failed to load status:', err)
      setError('Ошибка загрузки статуса')
    }
  }

  const preloadCategories = async (marketplace) => {
    setLoading({ ...loading, [marketplace]: true })
    setError(null)

    try {
      const response = await api.post(`/api/admin/categories/preload?marketplace=${marketplace}`)
      alert(`✅ ${response.data.message}`)
      
      // Подождать немного и обновить статус
      setTimeout(() => {
        loadStatus()
      }, 3000)
    } catch (err) {
      console.error(`Failed to preload ${marketplace}:`, err)
      const errorMsg = err.response?.data?.detail || err.message
      alert(`❌ Ошибка предзагрузки ${marketplace}: ${errorMsg}`)
      setError(errorMsg)
    } finally {
      setLoading({ ...loading, [marketplace]: false })
    }
  }

  const marketplaces = [
    { 
      id: 'ozon', 
      name: 'Ozon',
      color: 'blue',
      description: 'Категории и атрибуты Ozon'
    },
    { 
      id: 'wb', 
      name: 'Wildberries',
      color: 'purple',
      description: 'Категории и характеристики WB'
    },
    { 
      id: 'yandex', 
      name: 'Яндекс Маркет',
      color: 'yellow',
      description: 'Категории Яндекс Маркета'
    }
  ]

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Никогда'
    const date = new Date(dateStr)
    return date.toLocaleString('ru-RU')
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Управление категориями маркетплейсов
        </h1>
        <p className="text-gray-600">
          Предзагрузите категории со всех маркетплейсов для быстрого поиска при создании товаров
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <FiAlertCircle className="text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-800 font-medium">Ошибка</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-blue-900 mb-2">ℹ️ Как это работает?</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Категории загружаются один раз для всех пользователей</li>
          <li>• Данные кэшируются в базе данных для быстрого поиска</li>
          <li>• Обновляйте категории раз в месяц или при изменениях на маркетплейсах</li>
          <li>• Процесс занимает 1-3 минуты в зависимости от маркетплейса</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {marketplaces.map(mp => {
          const mpStatus = status[mp.id] || {}
          const isLoaded = mpStatus.total_categories > 0
          const lastUpdate = mpStatus.last_updated

          return (
            <div 
              key={mp.id}
              className={`bg-white border-2 border-${mp.color}-200 rounded-lg p-6 shadow-sm`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`text-lg font-bold text-${mp.color}-700`}>
                    {mp.name}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {mp.description}
                  </p>
                </div>
                {isLoaded && (
                  <FiCheck className="text-green-600 text-xl flex-shrink-0" />
                )}
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Категорий загружено:</span>
                  <span className="font-bold text-gray-900">
                    {mpStatus.total_categories || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Последнее обновление:</span>
                  <span className="font-medium text-gray-700 text-xs">
                    {formatDate(lastUpdate)}
                  </span>
                </div>
              </div>

              <button
                onClick={() => preloadCategories(mp.id)}
                disabled={loading[mp.id]}
                className={`w-full py-2 px-4 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2 ${
                  loading[mp.id]
                    ? `bg-${mp.color}-300 cursor-not-allowed`
                    : `bg-${mp.color}-600 hover:bg-${mp.color}-700`
                }`}
              >
                {loading[mp.id] ? (
                  <>
                    <FiRefreshCw className="animate-spin" />
                    Загрузка...
                  </>
                ) : isLoaded ? (
                  <>
                    <FiRefreshCw />
                    Обновить категории
                  </>
                ) : (
                  <>
                    <FiDownload />
                    Загрузить категории
                  </>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">⚠️ Важно</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• Для загрузки категорий необходимы действующие API ключи маркетплейсов</li>
          <li>• Убедитесь, что вы добавили интеграции в разделе "Интеграции"</li>
          <li>• Процесс запускается в фоне, обновите страницу через минуту для проверки</li>
        </ul>
      </div>
    </div>
  )
}
