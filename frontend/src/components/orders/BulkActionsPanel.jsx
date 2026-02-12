import React from 'react'
import { FiPrinter, FiDownload, FiEdit, FiX } from 'react-icons/fi'

function BulkActionsPanel({ selectedCount, onPrintLabels, onExportExcel, onChangeStatus, onClearSelection }) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-8 right-8 card-neon p-6 shadow-2xl z-40 min-w-96" data-testid="bulk-actions-panel">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-mm-text-secondary uppercase font-mono">// Выбрано</p>
          <p className="text-2xl text-mm-cyan font-mono font-bold">{selectedCount}</p>
        </div>
        <button
          onClick={onClearSelection}
          className="p-2 hover:bg-mm-border rounded transition-colors"
          data-testid="clear-selection"
        >
          <FiX size={20} className="text-mm-text-secondary" />
        </button>
      </div>

      <div className="space-y-2">
        <button
          onClick={onPrintLabels}
          className="w-full btn-neon flex items-center justify-center space-x-2"
          data-testid="bulk-print-labels"
        >
          <FiPrinter />
          <span>ПЕЧАТЬ ЭТИКЕТКИ</span>
        </button>

        <button
          onClick={onExportExcel}
          className="w-full px-4 py-2 bg-mm-green/20 text-mm-green border border-mm-green rounded hover:bg-mm-green/30 transition-colors font-mono text-sm flex items-center justify-center space-x-2"
          data-testid="bulk-export-excel"
        >
          <FiDownload />
          <span>ЭКСПОРТ В EXCEL</span>
        </button>

        <button
          onClick={onChangeStatus}
          className="w-full px-4 py-2 bg-mm-border/50 text-mm-text border border-mm-border rounded hover:bg-mm-border transition-colors font-mono text-sm flex items-center justify-center space-x-2"
          data-testid="bulk-change-status"
        >
          <FiEdit />
          <span>ИЗМЕНИТЬ СТАТУС</span>
        </button>
      </div>
    </div>
  )
}

export default BulkActionsPanel
