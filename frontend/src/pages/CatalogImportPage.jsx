import React, { useState } from 'react'
import { FiArrowLeft, FiDownload, FiUpload, FiCheck, FiX } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function CatalogImportPage() {
  const { api } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1: выбор, 2: загрузка, 3: результат
  const [importType, setImportType] = useState('') // 'marketplace' или 'excel'
  const [selectedMarketplace, setSelectedMarketplace] = useState('')
  const [file, setFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        alert('Пожалуйста, выберите Excel файл (.xlsx или .xls)')
        return
      }
      setFile(selectedFile)
    }
  }

  const handleDownloadTemplate = () => {
    // TODO: Реализовать скачивание шаблона Excel
    alert('Скачивание шаблона Excel будет реализовано в следующей версии')
  }

  const handleImportFromMarketplace = async () => {
    if (!selectedMarketplace) {
      alert('Выберите маркетплейс')
      return
    }

    setImporting(true)
    try {
      const response = await api.post('/api/catalog/import/marketplace', null, {
        params: { marketplace: selectedMarketplace }
      })
      setResult(response.data)
      setStep(3)
    } catch (error) {
      alert('Ошибка импорта: ' + (error.response?.data?.detail || error.message))
    } finally {
      setImporting(false)
    }
  }

  const handleImportFromExcel = async () => {
    if (!file) {
      alert('Выберите файл')
      return
    }

    setImporting(true)
    try {
      // TODO: Реализовать импорт из Excel
      const formData = new FormData()
      formData.append('file', file)
      
      alert('Импорт из Excel будет реализован в следующей версии')
      // const response = await api.post('/api/catalog/import/excel', formData, {
      //   headers: { 'Content-Type': 'multipart/form-data' }
      // })
      // setResult(response.data)
      // setStep(3)
    } catch (error) {
      alert('Ошибка импорта: ' + error.message)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-mm-cyan hover:underline mb-2 flex items-center gap-2"
        >
          <FiArrowLeft /> Назад к товарам
        </button>
        <h1 className="text-3xl font-bold text-mm-cyan">ИМПОРТ ТОВАРОВ</h1>
        <p className="text-sm text-mm-text-secondary mt-1">
          Импортируйте товары с маркетплейсов или загрузите из Excel
        </p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step >= 1 ? 'text-mm-cyan' : 'text-mm-text-secondary'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 1 ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark'
          }`}>1</div>
          <span className="text-sm">Выбор источника</span>
        </div>
        <div className="flex-1 h-px bg-mm-border"></div>
        <div className={`flex items-center gap-2 ${step >= 2 ? 'text-mm-cyan' : 'text-mm-text-secondary'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 2 ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark'
          }`}>2</div>
          <span className="text-sm">Загрузка данных</span>
        </div>
        <div className="flex-1 h-px bg-mm-border"></div>
        <div className={`flex items-center gap-2 ${step >= 3 ? 'text-mm-cyan' : 'text-mm-text-secondary'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step >= 3 ? 'bg-mm-cyan text-mm-dark' : 'bg-mm-dark'
          }`}>3</div>
          <span className="text-sm">Результат</span>
        </div>
      </div>

      {/* Step 1: Выбор источника */}
      {step === 1 && (
        <div className="grid grid-cols-2 gap-6">
          {/* Импорт с маркетплейса */}
          <div
            onClick={() => {
              setImportType('marketplace')
              setStep(2)
            }}
            className={`p-8 rounded-lg cursor-pointer transition border-2 ${
              importType === 'marketplace'
                ? 'border-mm-cyan bg-mm-cyan/10'
                : 'border-mm-border bg-mm-secondary hover:border-mm-cyan/50'
            }`}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-mm-cyan/20 rounded-full flex items-center justify-center">
                <FiDownload className="text-3xl text-mm-cyan" />
              </div>
              <h3 className="text-xl font-bold text-mm-text">Импорт с маркетплейса</h3>
              <p className="text-sm text-mm-text-secondary">
                Загрузите товары напрямую с Wildberries, Ozon или Яндекс.Маркет через API
              </p>
              <ul className="text-xs text-mm-text-secondary text-left space-y-2">
                <li>✓ Автоматическая загрузка всех данных</li>
                <li>✓ Фото, цены, остатки</li>
                <li>✓ Быстрый импорт</li>
              </ul>
            </div>
          </div>

          {/* Импорт из Excel */}
          <div
            onClick={() => {
              setImportType('excel')
              setStep(2)
            }}
            className={`p-8 rounded-lg cursor-pointer transition border-2 ${
              importType === 'excel'
                ? 'border-mm-cyan bg-mm-cyan/10'
                : 'border-mm-border bg-mm-secondary hover:border-mm-cyan/50'
            }`}
          >
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-mm-cyan/20 rounded-full flex items-center justify-center">
                <FiUpload className="text-3xl text-mm-cyan" />
              </div>
              <h3 className="text-xl font-bold text-mm-text">Импорт из Excel</h3>
              <p className="text-sm text-mm-text-secondary">
                Загрузите товары из заполненного Excel-файла по шаблону
              </p>
              <ul className="text-xs text-mm-text-secondary text-left space-y-2">
                <li>✓ Массовое создание товаров</li>
                <li>✓ Редактирование в Excel</li>
                <li>✓ Удобный шаблон</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Загрузка данных */}
      {step === 2 && importType === 'marketplace' && (
        <div className="bg-mm-secondary p-8 rounded-lg space-y-6">
          <h2 className="text-2xl font-bold text-mm-text">Выберите маркетплейс</h2>
          
          <div className="grid grid-cols-3 gap-4">
            {['ozon', 'wb', 'yandex'].map((mp) => {
              const names = { ozon: 'Ozon', wb: 'Wildberries', yandex: 'Яндекс.Маркет' }
              const colors = { ozon: 'blue', wb: 'purple', yandex: 'red' }
              return (
                <div
                  key={mp}
                  onClick={() => setSelectedMarketplace(mp)}
                  className={`p-6 rounded-lg cursor-pointer transition border-2 text-center ${
                    selectedMarketplace === mp
                      ? `border-${colors[mp]}-500 bg-${colors[mp]}-500/10`
                      : 'border-mm-border hover:border-mm-cyan/50'
                  }`}
                >
                  <h3 className="text-lg font-bold text-mm-text">{names[mp]}</h3>
                </div>
              )
            })}
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded p-4">
            <p className="text-blue-300 text-sm">
              💡 <strong>Важно:</strong> Убедитесь, что у вас настроена интеграция с выбранным маркетплейсом
              в разделе "ИНТЕГРАЦИИ".
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-mm-dark text-mm-text hover:bg-mm-dark/80 rounded"
            >
              Назад
            </button>
            <button
              onClick={handleImportFromMarketplace}
              disabled={!selectedMarketplace || importing}
              className="flex-1 px-6 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Импортируем...' : 'Начать импорт'}
            </button>
          </div>
        </div>
      )}

      {step === 2 && importType === 'excel' && (
        <div className="bg-mm-secondary p-8 rounded-lg space-y-6">
          <h2 className="text-2xl font-bold text-mm-text">Загрузка Excel файла</h2>
          
          {/* Шаблон */}
          <div className="bg-mm-dark p-4 rounded-lg">
            <h3 className="text-lg font-bold text-mm-text mb-2">Шаг 1: Скачайте шаблон</h3>
            <p className="text-sm text-mm-text-secondary mb-4">
              Скачайте шаблон Excel, заполните его данными о товарах и загрузите обратно
            </p>
            <button
              onClick={handleDownloadTemplate}
              className="px-4 py-2 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded flex items-center gap-2"
            >
              <FiDownload /> Скачать шаблон Excel
            </button>
          </div>

          {/* Загрузка */}
          <div className="bg-mm-dark p-4 rounded-lg">
            <h3 className="text-lg font-bold text-mm-text mb-2">Шаг 2: Загрузите файл</h3>
            <p className="text-sm text-mm-text-secondary mb-4">
              Загрузите заполненный Excel файл с товарами
            </p>
            
            <div className="border-2 border-dashed border-mm-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer inline-block"
              >
                <div className="space-y-2">
                  <FiUpload className="mx-auto text-4xl text-mm-cyan" />
                  <p className="text-mm-text">
                    {file ? file.name : 'Перетащите файл или нажмите для выбора'}
                  </p>
                  <p className="text-xs text-mm-text-secondary">
                    Поддерживаются форматы: .xlsx, .xls
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-4">
            <p className="text-yellow-300 text-sm">
              ⚠️ <strong>Внимание:</strong> При импорте существующие товары с такими же артикулами будут обновлены.
              Новые товары будут созданы.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 bg-mm-dark text-mm-text hover:bg-mm-dark/80 rounded"
            >
              Назад
            </button>
            <button
              onClick={handleImportFromExcel}
              disabled={!file || importing}
              className="flex-1 px-6 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Импортируем...' : 'Начать импорт'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Результат */}
      {step === 3 && result && (
        <div className="bg-mm-secondary p-8 rounded-lg space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4">
              <FiCheck className="text-4xl text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-mm-text mb-2">Импорт завершен!</h2>
            <p className="text-mm-text-secondary">Товары успешно импортированы в каталог</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-mm-dark p-4 rounded-lg">
              <div className="text-3xl font-bold text-green-400">{result.created || 0}</div>
              <div className="text-sm text-mm-text-secondary mt-1">Создано</div>
            </div>
            <div className="bg-mm-dark p-4 rounded-lg">
              <div className="text-3xl font-bold text-blue-400">{result.updated || 0}</div>
              <div className="text-sm text-mm-text-secondary mt-1">Обновлено</div>
            </div>
            <div className="bg-mm-dark p-4 rounded-lg">
              <div className="text-3xl font-bold text-red-400">{result.errors || 0}</div>
              <div className="text-sm text-mm-text-secondary mt-1">Ошибок</div>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full px-6 py-3 bg-mm-cyan text-mm-dark hover:bg-mm-cyan/90 rounded"
          >
            Перейти к товарам
          </button>
        </div>
      )}
    </div>
  )
}
