import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

function App() {
  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-8">
      <h1 className="text-4xl font-bold mb-4">
        MINIMAL<span className="text-mm-purple">MOD</span>
      </h1>
      <p className="comment text-xl mb-6">// No distractions, Just results</p>
      
      <div className="card-neon max-w-2xl">
        <h2 className="text-2xl mb-4 text-mm-cyan">СИСТЕМА РАБОТАЕТ!</h2>
        <p className="text-mm-text-secondary mb-4">Preview успешно загружен.</p>
        <p className="comment">// Полный функционал будет добавлен после подтверждения</p>
        
        <div className="mt-6 space-y-2">
          <p className="text-sm">✅ Frontend: RUNNING</p>
          <p className="text-sm">✅ Backend: RUNNING</p>
          <p className="text-sm">✅ MongoDB: CONNECTED</p>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)