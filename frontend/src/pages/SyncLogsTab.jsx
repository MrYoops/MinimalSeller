import React, { useState, useEffect } from 'react';
import { FiRefreshCw, FiCheck, FiX, FiClock, FiAlertCircle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function SyncLogsTab() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, success, error

  useEffect(() => {
    loadLogs();
  }, [filter]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/sync/logs', {
        params: { status: filter !== 'all' ? filter : undefined }
      });
      setLogs(response.data.logs || []);
    } catch (error) {
      console.error('Failed to load sync logs:', error);
      // Show placeholder data for now
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success':
        return <FiCheck className="w-5 h-5 text-green-400" />;
      case 'error':
        return <FiX className="w-5 h-5 text-red-400" />;
      case 'pending':
        return <FiClock className="w-5 h-5 text-yellow-400" />;
      default:
        return <FiAlertCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      success: 'bg-green-500/20 text-green-400 border-green-500/30',
      error: 'bg-red-500/20 text-red-400 border-red-500/30',
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${styles[status] || 'bg-gray-500/20 text-gray-400'}`}>
        {status === 'success' ? 'Успешно' : status === 'error' ? 'Ошибка' : 'В процессе'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <FiRefreshCw className="w-8 h-8 animate-spin text-mm-cyan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-mm-text">Логи синхронизации</h2>
          <p className="text-sm text-mm-text-secondary mt-1">История отправки карточек и цен на маркетплейсы</p>
        </div>
        <button
          onClick={loadLogs}
          className="px-4 py-2 bg-mm-secondary text-mm-text border border-mm-border rounded hover:border-mm-cyan transition-colors flex items-center gap-2"
        >
          <FiRefreshCw className="w-4 h-4" />
          Обновить
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'success', 'error'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded transition-colors ${
              filter === status
                ? 'bg-mm-cyan text-mm-dark font-medium'
                : 'bg-mm-secondary text-mm-text hover:border-mm-cyan border border-mm-border'
            }`}
          >
            {status === 'all' ? 'Все' : status === 'success' ? 'Успешные' : 'Ошибки'}
          </button>
        ))}
      </div>

      {/* Logs Table */}
      <div className="bg-mm-secondary rounded-lg border border-mm-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-mm-dark">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Дата/Время</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Тип</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Маркетплейс</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Товар</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Статус</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-mm-text-secondary uppercase">Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FiClock className="w-12 h-12 text-mm-text-secondary opacity-50" />
                    <p className="text-mm-text-secondary">Логов синхронизации пока нет</p>
                    <p className="text-sm text-mm-text-secondary opacity-70">
                      Логи появятся после отправки товаров или цен на маркетплейсы
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log, idx) => (
                <tr key={idx} className="border-t border-mm-border hover:bg-mm-dark/30 transition-colors">
                  <td className="px-4 py-3 text-sm text-mm-text">
                    {new Date(log.timestamp).toLocaleString('ru-RU')}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 bg-mm-dark rounded text-xs text-mm-cyan">
                      {log.type === 'product' ? 'Товар' : log.type === 'price' ? 'Цена' : log.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {log.marketplace === 'ozon' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">O</span>
                        <span className="text-mm-text">Ozon</span>
                      </span>
                    )}
                    {log.marketplace === 'wb' && (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-6 h-6 bg-purple-600 text-white rounded flex items-center justify-center text-xs font-bold">WB</span>
                        <span className="text-mm-text">Wildberries</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-mm-text font-mono">{log.product_article}</div>
                    <div className="text-xs text-mm-text-secondary truncate max-w-xs">{log.product_name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status)}
                      {getStatusBadge(log.status)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-mm-text-secondary max-w-md truncate">
                    {log.message || log.error || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">О логах синхронизации</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300/80">
              <li>Здесь отображается история всех операций с маркетплейсами</li>
              <li>Логи включают отправку карточек товаров и обновление цен</li>
              <li>Ошибки подсвечиваются красным для быстрой диагностики</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
