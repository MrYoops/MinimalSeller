import React, { useState, useRef, useEffect } from 'react';
import { FiPackage, FiDollarSign, FiLink, FiUpload, FiGrid, FiChevronDown } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';

const CatalogNavDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { label: 'Товары', path: '/catalog/products', icon: FiGrid },
    { label: 'Категории', path: '/catalog/categories', icon: FiPackage },
    { label: 'Цены', path: '/catalog/pricing', icon: FiDollarSign },
    { label: 'Сопоставление', path: '/catalog/matching', icon: FiLink },
    { label: 'Импорт товаров', path: '/catalog/import', icon: FiUpload }
  ];

  const currentPage = menuItems.find(item => location.pathname === item.path);
  const currentLabel = currentPage ? currentPage.label : 'Товары';

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleItemClick = (path) => {
    setIsOpen(false);
    navigate(path);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-mm-secondary text-mm-cyan hover:bg-mm-secondary/80 rounded flex items-center gap-2 font-mono uppercase text-sm"
      >
        <FiPackage className="w-4 h-4" />
        {currentLabel}
        <FiChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 bg-white rounded-lg shadow-2xl border-2 border-gray-300 py-2 z-[9999] min-w-[220px]">
          {menuItems.map((item, idx) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={idx}
                onClick={() => handleItemClick(item.path)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 text-sm transition-colors font-medium ${\n                  isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:text-blue-600'\n                }`}
              >
                <Icon className=\"w-4 h-4\" />
                {item.label}
                {isActive && <span className=\"ml-auto text-xs text-blue-500\">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CatalogNavDropdown;
