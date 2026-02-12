import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'dark'
  })
  
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('language') || 'ru'
  })

  useEffect(() => {
    localStorage.setItem('theme', theme)
    // Apply theme to document
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme')
    } else {
      document.documentElement.classList.remove('light-theme')
    }
  }, [theme])

  useEffect(() => {
    localStorage.setItem('language', language)
  }, [language])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const changeLanguage = (lang) => {
    setLanguage(lang)
  }

  return (
    <ThemeContext.Provider value={{ theme, language, toggleTheme, changeLanguage }}>
      {children}
    </ThemeContext.Provider>
  )
}
