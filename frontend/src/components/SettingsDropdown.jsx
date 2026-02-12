import React, { useState, useRef, useEffect } from 'react'
import { FiSettings, FiSun, FiMoon, FiGlobe } from 'react-icons/fi'
import { useTheme } from '../context/ThemeContext'

function SettingsDropdown() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { theme, language, toggleTheme, changeLanguage } = useTheme()

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 border-2 border-mm-cyan text-mm-cyan hover:bg-mm-cyan/10 transition-colors"
        data-testid="settings-button"
      >
        <FiSettings size={20} className={isOpen ? 'animate-spin' : ''} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="absolute right-0 mt-2 w-80 bg-mm-dark border-2 border-mm-cyan shadow-neon-cyan z-50"
          data-testid="settings-dropdown"
        >
          <div className="p-6 space-y-6">
            {/* Theme Section */}
            <div>
              <p className="text-mm-text-secondary uppercase text-xs mb-3 font-mono">THEME</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (theme !== 'dark') toggleTheme()
                  }}
                  className={`p-4 border-2 transition-all ${
                    theme === 'dark'
                      ? 'border-mm-purple bg-mm-purple/10 text-mm-purple'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                  data-testid="theme-dark"
                >
                  <FiMoon className="mx-auto mb-2" size={24} />
                  <p className="font-mono text-sm">Dark</p>
                </button>
                
                <button
                  onClick={() => {
                    if (theme !== 'light') toggleTheme()
                  }}
                  className={`p-4 border-2 transition-all ${
                    theme === 'light'
                      ? 'border-mm-purple bg-mm-purple/10 text-mm-purple'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                  data-testid="theme-light"
                >
                  <FiSun className="mx-auto mb-2" size={24} />
                  <p className="font-mono text-sm">Light</p>
                </button>
              </div>
            </div>

            {/* Language Section */}
            <div>
              <p className="text-mm-text-secondary uppercase text-xs mb-3 font-mono">LANGUAGE</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => changeLanguage('ru')}
                  className={`p-4 border-2 transition-all ${
                    language === 'ru'
                      ? 'border-mm-purple bg-mm-purple/10 text-mm-purple'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                  data-testid="lang-ru"
                >
                  <FiGlobe className="mx-auto mb-2" size={24} />
                  <p className="font-mono text-sm">RU</p>
                </button>
                
                <button
                  onClick={() => changeLanguage('en')}
                  className={`p-4 border-2 transition-all ${
                    language === 'en'
                      ? 'border-mm-purple bg-mm-purple/10 text-mm-purple'
                      : 'border-mm-border text-mm-text-secondary hover:border-mm-cyan'
                  }`}
                  data-testid="lang-en"
                >
                  <FiGlobe className="mx-auto mb-2" size={24} />
                  <p className="font-mono text-sm">EN</p>
                </button>
              </div>
            </div>

            {/* Currency Section */}
            <div>
              <p className="text-mm-text-secondary uppercase text-xs mb-3 font-mono">CURRENCY</p>
              <select className="input-neon w-full" defaultValue="RUB">
                <option value="RUB">RUB ₽</option>
                <option value="USD">USD $</option>
                <option value="EUR">EUR €</option>
              </select>
            </div>

            <div className="pt-4 border-t border-mm-border">
              <p className="comment text-xs text-center">// Settings saved automatically</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsDropdown
