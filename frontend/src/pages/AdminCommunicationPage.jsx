import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiMessageSquare, FiStar, FiTrash2 } from 'react-icons/fi'

function AdminCommunicationPage() {
  const { api } = useAuth()
  const [activeTab, setActiveTab] = useState('questions')
  const [questions, setQuestions] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    try {
      if (activeTab === 'questions') {
        const response = await api.get('/api/questions')
        setQuestions(response.data)
      } else {
        const response = await api.get('/api/reviews')
        setReviews(response.data)
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    }
    setLoading(false)
  }

  const deleteQuestion = async (id) => {
    if (!confirm('Delete this question? This action cannot be undone.')) return
    
    try {
      await api.delete(`/api/admin/questions/${id}`)
      alert('Question deleted!')
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  const deleteReview = async (id) => {
    if (!confirm('Delete this review? This action cannot be undone.')) return
    
    try {
      await api.delete(`/api/admin/reviews/${id}`)
      alert('Review deleted!')
      loadData()
    } catch (error) {
      alert('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">COMMUNICATION MODERATION</h2>
        <p className="comment">// Moderate questions and reviews from all sellers</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-4 border-b border-mm-border">
        <button
          onClick={() => setActiveTab('questions')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'questions'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiMessageSquare className="inline mr-2" />
          QUESTIONS
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-4 py-3 font-mono uppercase text-sm transition-colors ${
            activeTab === 'reviews'
              ? 'text-mm-cyan border-b-2 border-mm-cyan'
              : 'text-mm-text-secondary hover:text-mm-cyan'
          }`}
        >
          <FiStar className="inline mr-2" />
          REVIEWS
        </button>
      </div>

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : questions.length === 0 ? (
            <div className="card-neon text-center py-12">
              <FiMessageSquare className="mx-auto text-mm-text-tertiary mb-4" size={48} />
              <p className="text-mm-text-secondary">No questions to moderate</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => (
                <div key={q.id} className="card-neon">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm text-mm-text-secondary">
                        {q.product_sku} - {q.product_name}
                      </p>
                      <p className="text-xs comment">{new Date(q.created_at).toLocaleDateString()}</p>
                    </div>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
                    >
                      <FiTrash2 className="inline mr-1" />
                      DELETE
                    </button>
                  </div>
                  <div className="bg-mm-darker p-4 border-l-2 border-mm-cyan">
                    <p className="comment text-xs mb-1">// Question:</p>
                    <p className="text-mm-text">{q.question}</p>
                  </div>
                  {q.answer && (
                    <div className="bg-mm-darker p-4 border-l-2 border-mm-green mt-3">
                      <p className="comment text-xs mb-1">// Answer:</p>
                      <p className="text-mm-text">{q.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-mm-cyan animate-pulse">// LOADING...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="card-neon text-center py-12">
              <FiStar className="mx-auto text-mm-text-tertiary mb-4" size={48} />
              <p className="text-mm-text-secondary">No reviews to moderate</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="card-neon">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-sm text-mm-text-secondary">
                        {review.product_sku} - {review.product_name}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <FiStar
                              key={star}
                              className={star <= review.rating ? 'text-mm-yellow fill-mm-yellow' : 'text-mm-text-tertiary'}
                              size={14}
                            />
                          ))}
                        </div>
                        <span className="text-xs comment">{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteReview(review.id)}
                      className="px-3 py-1 border border-mm-red text-mm-red hover:bg-mm-red/10 text-xs uppercase font-mono"
                    >
                      <FiTrash2 className="inline mr-1" />
                      DELETE
                    </button>
                  </div>
                  <div className="bg-mm-darker p-4 border-l-2 border-mm-cyan">
                    <p className="text-mm-text">{review.text}</p>
                    <p className="text-xs text-mm-text-secondary mt-2">— {review.customer_name}</p>
                  </div>
                  {review.seller_reply && (
                    <div className="bg-mm-darker p-4 border-l-2 border-mm-green mt-3">
                      <p className="comment text-xs mb-1">// Seller Reply:</p>
                      <p className="text-mm-text">{review.seller_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminCommunicationPage
