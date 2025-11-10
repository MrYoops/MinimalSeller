import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

// Минимальное приложение для проверки
function App() {
  const [page, setPage] = React.useState('home')
  
  return (
    <div className="min-h-screen bg-mm-black text-mm-text p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">
          MINIMAL<span className="text-mm-purple">MOD</span>
        </h1>
        <p className="comment text-xl mb-6">// Admin Panel</p>
        
        <div className="flex space-x-4 mb-6">
          <button onClick={() => setPage('home')} className="btn-primary">
            HOME
          </button>
          <button onClick={() => setPage('login')} className="btn-secondary">
            LOGIN
          </button>
        </div>
        
        <div className="card-neon">
          {page === 'home' ? (
            <div>
              <h2 className="text-2xl mb-4 text-mm-cyan">СИСТЕМА РАБОТАЕТ!</h2>
              <p className="text-mm-text-secondary mb-4">Preview успешно загружен.</p>
              <div className="mt-6 space-y-2">
                <p className="text-sm">✅ Frontend: RUNNING</p>
                <p className="text-sm">✅ Backend: RUNNING</p>
                <p className="text-sm">✅ React: WORKING</p>
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-2xl mb-4 text-mm-cyan">LOGIN</h2>
              <input className="input-neon w-full mb-3" placeholder="Email" />
              <input className="input-neon w-full mb-3" placeholder="Password" type="password" />
              <button className="btn-primary w-full">// LOGIN</button>
            </div>
          )}
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