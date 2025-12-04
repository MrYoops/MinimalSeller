import React, { useState } from 'react'
import { FiChevronDown } from 'react-icons/fi'
import FBSOrdersList from '../components/orders/FBSOrdersList'
import FBOOrdersList from '../components/orders/FBOOrdersList'
import RetailOrdersList from '../components/orders/RetailOrdersList'

function OrdersPageNew() {
  const [selectedSection, setSelectedSection] = useState('fbs')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const sections = [
    { value: 'fbs', label: 'FBS (со своего склада)', color: 'text-mm-cyan' },
    { value: 'fbo', label: 'FBO (со склада МП)', color: 'text-mm-purple' },
    { value: 'retail', label: 'Розничные заказы', color: 'text-mm-green' }
  ]

  const currentSection = sections.find(s => s.value === selectedSection)

  return (
    <div className="space-y-6" data-testid="orders-page">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl mb-2 text-mm-cyan uppercase font-mono">Заказы</h2>
          <p className="text-sm text-mm-text-secondary font-mono">// Управление заказами со всех источников</p>
        </div>
      </div>

      {/* ВЫПАДАЮЩИЙ СПИСОК РАЗДЕЛОВ */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full md:w-96 flex items-center justify-between px-4 py-3 bg-mm-gray border border-mm-border rounded hover:border-mm-cyan transition-colors"
          data-testid="section-dropdown"
        >
          <span className={`font-mono text-sm ${currentSection.color}`}>
            {currentSection.label}
          </span>
          <FiChevronDown className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute z-10 w-full md:w-96 mt-2 bg-mm-gray border border-mm-border rounded shadow-lg">
            {sections.map(section => (
              <button
                key={section.value}
                onClick={() => {
                  setSelectedSection(section.value)
                  setIsDropdownOpen(false)
                }}
                className={`w-full text-left px-4 py-3 font-mono text-sm hover:bg-mm-cyan/10 transition-colors border-b border-mm-border last:border-b-0 ${
                  selectedSection === section.value ? 'bg-mm-cyan/20' : ''
                } ${section.color}`}
                data-testid={`section-${section.value}`}
              >
                {section.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* КОНТЕНТ РАЗДЕЛА */}
      <div className="mt-6">
        {selectedSection === 'fbs' && <FBSOrdersList />}
        {selectedSection === 'fbo' && <FBOOrdersList />}
        {selectedSection === 'retail' && <RetailOrdersList />}
      </div>
    </div>
  )
}

export default OrdersPageNew
