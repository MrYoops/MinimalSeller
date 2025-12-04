import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiLogOut, FiKey, FiPackage, FiShoppingCart, FiPieChart, FiDollarSign, FiChevronDown, FiGrid, FiLink, FiUpload, FiTag, FiBox, FiDownload, FiActivity, FiLayers, FiUser } from 'react-icons/fi';
import { BsBoxSeam } from 'react-icons/bs';
import SettingsDropdown from './SettingsDropdown';

// Dropdown component for main navigation
const MainNavDropdown = ({ title, icon: Icon, items, isActive }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef(null);
  const navigate = useNavigate();

  React.useEffect(() => {
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
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap flex items-center gap-1 h-12 ${
          isActive ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
        }`}
      >
        <Icon className="inline" />
        {title}
        <FiChevronDown className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div 
          className="absolute top-full left-0 mt-1 bg-mm-darker rounded-lg shadow-2xl border border-mm-border py-2 min-w-[220px]"
          style={{ zIndex: 9999 }}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleItemClick(item.path)}
              className="w-full text-left px-4 py-3 hover:bg-mm-gray flex items-center gap-3 text-sm text-mm-text hover:text-mm-cyan transition-colors font-medium"
            >
              {item.icon && <item.icon className="w-4 h-4" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MainLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine active section based on current path
  const isWarehouseActive = location.pathname.startsWith('/warehouses') || 
                            location.pathname.startsWith('/suppliers') || 
                            location.pathname.startsWith('/income-orders') ||
                            location.pathname.startsWith('/stock');
  
  const isProductsActive = location.pathname.startsWith('/catalog') ||
                           location.pathname.startsWith('/products');
  
  const isOrdersActive = location.pathname.startsWith('/orders');

  const warehouseItems = [
    { label: 'Склады', path: '/warehouses', icon: BsBoxSeam },
    { label: 'Поставщики', path: '/suppliers', icon: FiUser },
    { label: 'Приёмка на склад', path: '/income-orders', icon: FiDownload },
    { label: 'Остатки', path: '/stock', icon: FiBox },
    { label: 'Синхронизация', path: '/stock/sync', icon: FiActivity },
  ];

  const productsItems = [
    { label: 'Товары', path: '/catalog/products', icon: FiGrid },
    { label: 'Категории', path: '/catalog/categories', icon: FiTag },
    { label: 'Цены', path: '/catalog/pricing', icon: FiDollarSign },
    { label: 'Сопоставление', path: '/catalog/matching', icon: FiLink },
    { label: 'Импорт товаров', path: '/catalog/import', icon: FiUpload },
  ];

  const ordersItems = [
    { label: 'FBS (со своего склада)', path: '/orders/fbs', icon: FiPackage },
    { label: 'FBO (со склада МП)', path: '/orders/fbo', icon: FiBox },
    { label: 'Розничные заказы', path: '/orders/retail', icon: FiShoppingCart },
  ];

  return (
    <div className="min-h-screen bg-mm-black">
      {/* Header */}
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 
              className="text-2xl font-bold cursor-pointer" 
              onClick={() => navigate('/')}
            >
              MINIMAL<span className="text-mm-purple">MOD</span> <span className="status-new">SELLER</span>
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-mm-text-secondary">{user?.email}</span>
              <SettingsDropdown />
              <button onClick={logout} className="btn-primary">LOGOUT</button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-mm-border bg-mm-dark relative" style={{ zIndex: 100 }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-6 h-12">
            <button
              onClick={() => navigate('/integrations')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap flex items-center gap-1 h-12 ${
                location.pathname === '/integrations' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiKey className="inline" />
              ИНТЕГРАЦИИ
            </button>
            
            {/* Склад dropdown */}
            <MainNavDropdown
              title="СКЛАД"
              icon={BsBoxSeam}
              items={warehouseItems}
              isActive={isWarehouseActive}
            />
            
            {/* Товары dropdown */}
            <MainNavDropdown
              title="ТОВАРЫ"
              icon={FiPackage}
              items={productsItems}
              isActive={isProductsActive}
            />
            
            {/* Заказы dropdown */}
            <MainNavDropdown
              title="ЗАКАЗЫ"
              icon={FiShoppingCart}
              items={ordersItems}
              isActive={isOrdersActive}
            />
            
            <button
              onClick={() => navigate('/finance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap flex items-center gap-1 h-12 ${
                location.pathname === '/finance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiPieChart className="inline" />
              ФИНАНСЫ
            </button>
            
            <button
              onClick={() => navigate('/balance')}
              className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap flex items-center gap-1 h-12 ${
                location.pathname === '/balance' ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
              }`}
            >
              <FiDollarSign className="inline" />
              БАЛАНС
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;
