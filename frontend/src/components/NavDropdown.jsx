import React, { useState, useRef, useEffect } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const NavDropdown = ({ title, icon: Icon, items, isActive }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(`NavDropdown "${title}" isOpen:`, isOpen);
  }, [isOpen, title]);

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
    console.log('Nav item clicked:', path);
    setIsOpen(false);
    navigate(path);
  };

  const handleToggle = () => {
    console.log('Toggle dropdown, current state:', isOpen);
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`px-4 font-mono uppercase text-sm transition-colors whitespace-nowrap flex items-center gap-1 h-12 ${
          isActive ? 'text-mm-cyan border-b-2 border-mm-cyan' : 'text-mm-text-secondary hover:text-mm-cyan'
        }`}
      >
        <Icon className="inline" />
        {title}
        <FiChevronDown className={`ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-2xl border-2 border-gray-300 py-2 z-[9999] min-w-[220px]">
          {items.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleItemClick(item.path)}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-3 text-sm text-gray-700 hover:text-blue-600 transition-colors font-medium"
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

export default NavDropdown;
