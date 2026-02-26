import React, { useState } from 'react'
import axios from '../../api/axios'

export default function FeedbackForm({ interviewId, onSaved }) {
  const [rating, setRating] = useState(5)
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!interviewId) return setError('Missing interview id')
    try {
      setSubmitting(true)
      const payload = { rating, comments }
      const res = await axios.post(`/v1/interviews/${interviewId}/submit-feedback`, payload)
      onSaved && onSaved(res.data)
      setRating(5)
      setComments('')
    } catch (err) {
      console.error('Feedback save failed', err)
      setError(err?.response?.data?.detail || 'Failed to save feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded shadow">
      <h4 className="font-semibold mb-2">Leave feedback</h4>
      <div className="mb-3">
        <label className="block text-sm mb-1">Rating: {rating}</label>
        <input
          type="range"
          min="1"
          max="5"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          className="w-full"
        />
      </div>

      <div className="mb-3">
        <label className="block text-sm mb-1">Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          className="w-full p-2 border rounded"
          placeholder="Add any notes for the candidate or hiring team"
        />
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {submitting ? 'Saving...' : 'Submit Feedback'}
        </button>
        <button type="button" onClick={() => { setRating(5); setComments('') }} className="bg-gray-200 px-4 py-2 rounded">
          Reset
        </button>
      </div>
    </form>
  )
}
