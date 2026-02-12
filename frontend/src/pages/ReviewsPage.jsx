import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiStar } from 'react-icons/fi'

function ReviewsPage() {
  const { api } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [showReplyModal, setShowReplyModal] = useState(false)
  const [currentReview, setCurrentReview] = useState(null)
  const [reply, setReply] = useState('')

  useEffect(() => {
    loadReviews()
  }, [])

  const loadReviews = async () => {
    try {
      const response = await api.get('/api/reviews')
      setReviews(response.data)
    } catch (error) {
      console.error('Failed to load reviews:', error)
    }
    setLoading(false)
  }

  const replyToReview = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/reviews/${currentReview.id}/reply`, { reply })
      setShowReplyModal(false)
      setReply('')
      setCurrentReview(null)
      loadReviews()
      alert('Reply posted!')
    } catch (error) {
      alert('Failed to post reply')
    }
  }

  const renderStars = (rating) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <FiStar
            key={star}
            className={star <= rating ? 'text-mm-yellow fill-mm-yellow' : 'text-mm-text-tertiary'}
            size={16}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">PRODUCT REVIEWS</h2>
        <p className="comment">// Manage customer reviews</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiStar className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No reviews yet</p>
          <p className="comment">// Customer reviews will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="card-neon">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm text-mm-text-secondary mb-1">
                    {review.product_sku} - {review.product_name}
                  </p>
                  <div className="flex items-center space-x-3">
                    {renderStars(review.rating)}
                    <span className="text-xs comment">{new Date(review.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {review.seller_reply ? (
                  <span className="status-active">REPLIED</span>
                ) : (
                  <span className="status-pending">PENDING</span>
                )}
              </div>

              <div className="bg-mm-darker p-4 border-l-2 border-mm-cyan mb-3">
                <p className="comment text-xs mb-1">// Review:</p>
                <p className="text-mm-text">{review.text}</p>
                <p className="text-xs text-mm-text-secondary mt-2">— {review.customer_name}</p>
              </div>

              {review.seller_reply ? (
                <div className="bg-mm-darker p-4 border-l-2 border-mm-green">
                  <p className="comment text-xs mb-1">// Your Reply:</p>
                  <p className="text-mm-text">{review.seller_reply}</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCurrentReview(review)
                    setShowReplyModal(true)
                  }}
                  className="btn-primary"
                >
                  REPLY TO REVIEW
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {showReplyModal && currentReview && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">REPLY TO REVIEW</h3>
              <button onClick={() => setShowReplyModal(false)} className="text-mm-text-secondary hover:text-mm-red">
                ✕
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-3 mb-3">
                {renderStars(currentReview.rating)}
                <span className="text-sm text-mm-text-secondary">by {currentReview.customer_name}</span>
              </div>
              <div className="bg-mm-darker p-4 border-l-2 border-mm-cyan">
                <p className="text-mm-text">{currentReview.text}</p>
              </div>
            </div>

            <form onSubmit={replyToReview} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Your Reply</label>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="input-neon w-full"
                  rows="5"
                  placeholder="Thank you for your feedback..."
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">POST REPLY</button>
                <button type="button" onClick={() => setShowReplyModal(false)} className="btn-secondary flex-1">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReviewsPage