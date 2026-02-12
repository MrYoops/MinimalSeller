import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { FiMessageSquare, FiStar } from 'react-icons/fi'

function QuestionsPage() {
  const { api } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAnswerModal, setShowAnswerModal] = useState(false)
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    loadQuestions()
  }, [])

  const loadQuestions = async () => {
    try {
      const response = await api.get('/api/questions')
      setQuestions(response.data)
    } catch (error) {
      console.error('Failed to load questions:', error)
    }
    setLoading(false)
  }

  const answerQuestion = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/api/questions/${currentQuestion.id}/answer`, { answer })
      setShowAnswerModal(false)
      setAnswer('')
      setCurrentQuestion(null)
      loadQuestions()
      alert('Answer posted!')
    } catch (error) {
      alert('Failed to post answer')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl mb-2 text-mm-cyan uppercase">PRODUCT QUESTIONS</h2>
        <p className="comment">// Answer customer questions</p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-mm-cyan animate-pulse">// LOADING...</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="card-neon text-center py-12">
          <FiMessageSquare className="mx-auto text-mm-text-tertiary mb-4" size={48} />
          <p className="text-mm-text-secondary mb-2">No questions yet</p>
          <p className="comment">// Customer questions will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="card-neon">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-sm text-mm-text-secondary mb-1">
                    {q.product_sku} - {q.product_name}
                  </p>
                  <p className="text-xs comment">
                    {new Date(q.created_at).toLocaleDateString()}
                  </p>
                </div>
                {q.status === 'pending' ? (
                  <span className="status-pending">PENDING</span>
                ) : (
                  <span className="status-active">ANSWERED</span>
                )}
              </div>

              <div className="bg-mm-darker p-4 border-l-2 border-mm-cyan mb-3">
                <p className="comment text-xs mb-1">// Question:</p>
                <p className="text-mm-text">{q.question}</p>
              </div>

              {q.answer ? (
                <div className="bg-mm-darker p-4 border-l-2 border-mm-green">
                  <p className="comment text-xs mb-1">// Your Answer:</p>
                  <p className="text-mm-text">{q.answer}</p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setCurrentQuestion(q)
                    setShowAnswerModal(true)
                  }}
                  className="btn-primary"
                >
                  ANSWER QUESTION
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Answer Modal */}
      {showAnswerModal && currentQuestion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="card-neon max-w-2xl w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl text-mm-cyan">ANSWER QUESTION</h3>
              <button onClick={() => setShowAnswerModal(false)} className="text-mm-text-secondary hover:text-mm-red">
                ✕
              </button>
            </div>

            <div className="mb-6 bg-mm-darker p-4 border-l-2 border-mm-cyan">
              <p className="comment text-xs mb-1">// Question:</p>
              <p className="text-mm-text">{currentQuestion.question}</p>
            </div>

            <form onSubmit={answerQuestion} className="space-y-6">
              <div>
                <label className="block text-sm mb-2 text-mm-text-secondary uppercase">Your Answer</label>
                <textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="input-neon w-full"
                  rows="5"
                  placeholder="Type your answer here..."
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button type="submit" className="btn-primary flex-1">POST ANSWER</button>
                <button type="button" onClick={() => setShowAnswerModal(false)} className="btn-secondary flex-1">CANCEL</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuestionsPage