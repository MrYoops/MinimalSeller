import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiLogOut, FiUsers } from 'react-icons/fi'
import SettingsDropdown from '../components/SettingsDropdown'

function AdminDashboard() {
  const { user, logout, api } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/admin/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to load users:', error)
    }
    setLoading(false)
  }

  const approveUser = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/approve`)
      loadUsers()
    } catch (error) {
      console.error('Failed to approve:', error)
    }
  }

  const blockUser = async (userId) => {
    try {
      await api.put(`/api/admin/users/${userId}/block`)
      loadUsers()
    } catch (error) {
      console.error('Failed to block:', error)
    }
  }

  return (
    <div className="min-h-screen bg-mm-black">
      <header className="border-b border-mm-border bg-mm-darker">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">
              MINIMAL<span className="text-mm-purple">MOD</span> <span className="status-active">ADMIN</span>
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-mm-text-secondary">{user?.email}</span>
              <SettingsDropdown />
              <button onClick={logout} className="btn-primary">LOGOUT</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <h2 className="text-2xl mb-4 text-mm-cyan">SELLERS MANAGEMENT</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : (
            <div className="card-neon overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-mm-border">
                    <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Email</th>
                    <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Name</th>
                    <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Role</th>
                    <th className="text-left py-4 px-4 text-mm-text-secondary uppercase text-sm">Status</th>
                    <th className="text-right py-4 px-4 text-mm-text-secondary uppercase text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-mm-border hover:bg-mm-gray">
                      <td className="py-4 px-4 font-mono text-sm">{u.email}</td>
                      <td className="py-4 px-4">{u.full_name}</td>
                      <td className="py-4 px-4">
                        <span className={u.role === 'admin' ? 'status-active' : 'status-new'}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={u.is_active ? 'status-active' : 'status-pending'}>
                          {u.is_active ? 'ACTIVE' : 'PENDING'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right space-x-2">
                        {!u.is_active && u.role === 'seller' && (
                          <button
                            onClick={() => approveUser(u.id)}
                            className="px-3 py-1 border border-mm-green text-mm-green text-xs"
                          >
                            APPROVE
                          </button>
                        )}
                        {u.is_active && u.role === 'seller' && (
                          <button
                            onClick={() => blockUser(u.id)}
                            className="px-3 py-1 border border-mm-red text-mm-red text-xs"
                          >
                            BLOCK
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard