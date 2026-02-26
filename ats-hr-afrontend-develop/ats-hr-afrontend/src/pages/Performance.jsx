import React, { useState, useEffect } from 'react'
import axios from '../api/axios'

function Performance() {
  const [reviews, setReviews] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedReview, setSelectedReview] = useState(null)
  
  const [newReview, setNewReview] = useState({
    employee_id: '',
    review_period_start: '',
    review_period_end: '',
    overall_rating: '',
    goals_achieved: [],
    strengths: '',
    areas_of_improvement: '',
    comments: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [reviewsRes, employeesRes] = await Promise.all([
        axios.get('/v1/performance'),
        axios.get('/v1/employees')
      ])
      setReviews(reviewsRes.data || [])
      setEmployees(employeesRes.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const createReview = async () => {
    try {
      await axios.post('/v1/performance', {
        ...newReview,
        overall_rating: parseFloat(newReview.overall_rating),
        goals_achieved: newReview.goals_achieved.length > 0 ? newReview.goals_achieved : []
      })
      setShowCreateModal(false)
      setNewReview({
        employee_id: '',
        review_period_start: '',
        review_period_end: '',
        overall_rating: '',
        goals_achieved: [],
        strengths: '',
        areas_of_improvement: '',
        comments: ''
      })
      loadData()
    } catch (error) {
      console.error('Error creating review:', error)
    }
  }

  const getRatingColor = (rating) => {
    if (rating >= 4.5) return 'text-green-600'
    if (rating >= 3.5) return 'text-blue-600'
    if (rating >= 2.5) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRatingLabel = (rating) => {
    if (rating >= 4.5) return 'Excellent'
    if (rating >= 3.5) return 'Good'
    if (rating >= 2.5) return 'Satisfactory'
    return 'Needs Improvement'
  }

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId)
    return employee?.full_name || 'Unknown'
  }

  if (loading) {
    return <div className="text-center py-12">Loading performance reviews...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Performance Management</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          Create Review
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Total Reviews</div>
          <div className="text-3xl font-bold mt-2">{reviews.length}</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Average Rating</div>
          <div className="text-3xl font-bold mt-2">
            {reviews.length > 0 
              ? (reviews.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / reviews.length).toFixed(1)
              : 'N/A'}
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Employees Reviewed</div>
          <div className="text-3xl font-bold mt-2">
            {new Set(reviews.map(r => r.employee_id)).size}
          </div>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500 text-lg">No performance reviews found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Create Your First Review
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">
                    {getEmployeeName(review.employee_id)}
                  </h3>
                  <div className="text-sm text-gray-500">
                    Review Period: {new Date(review.review_period_start).toLocaleDateString()} - {new Date(review.review_period_end).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${getRatingColor(review.overall_rating)}`}>
                    {review.overall_rating?.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {getRatingLabel(review.overall_rating)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2">Strengths</h4>
                  <p className="text-sm text-gray-700">{review.strengths || 'Not specified'}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-900 mb-2">Areas of Improvement</h4>
                  <p className="text-sm text-gray-700">{review.areas_of_improvement || 'Not specified'}</p>
                </div>
              </div>

              {review.goals_achieved && review.goals_achieved.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Goals Achieved</h4>
                  <ul className="list-disc list-inside text-sm text-gray-700">
                    {review.goals_achieved.map((goal, idx) => (
                      <li key={idx}>{goal.goal || goal}</li>
                    ))}
                  </ul>
                </div>
              )}

              {review.comments && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">Additional Comments</h4>
                  <p className="text-sm text-gray-700">{review.comments}</p>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setSelectedReview(review)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Create Performance Review</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Employee</label>
                <select
                  value={newReview.employee_id}
                  onChange={(e) => setNewReview({...newReview, employee_id: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Review Period Start</label>
                  <input
                    type="date"
                    value={newReview.review_period_start}
                    onChange={(e) => setNewReview({...newReview, review_period_start: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Review Period End</label>
                  <input
                    type="date"
                    value={newReview.review_period_end}
                    onChange={(e) => setNewReview({...newReview, review_period_end: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Overall Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  step="0.1"
                  value={newReview.overall_rating}
                  onChange={(e) => setNewReview({...newReview, overall_rating: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="4.5"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Strengths</label>
                <textarea
                  value={newReview.strengths}
                  onChange={(e) => setNewReview({...newReview, strengths: e.target.value})}
                  className="w-full p-2 border rounded h-24"
                  placeholder="What are the employee's key strengths?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Areas of Improvement</label>
                <textarea
                  value={newReview.areas_of_improvement}
                  onChange={(e) => setNewReview({...newReview, areas_of_improvement: e.target.value})}
                  className="w-full p-2 border rounded h-24"
                  placeholder="What areas need improvement?"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Additional Comments</label>
                <textarea
                  value={newReview.comments}
                  onChange={(e) => setNewReview({...newReview, comments: e.target.value})}
                  className="w-full p-2 border rounded h-24"
                  placeholder="Any additional feedback..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={createReview}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
              >
                Create Review
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">Performance Review Details</h2>
            <div className="space-y-4">
              <div>
                <strong>Employee:</strong> {getEmployeeName(selectedReview.employee_id)}
              </div>
              <div>
                <strong>Review Period:</strong> {new Date(selectedReview.review_period_start).toLocaleDateString()} - {new Date(selectedReview.review_period_end).toLocaleDateString()}
              </div>
              <div>
                <strong>Overall Rating:</strong> <span className={`text-2xl font-bold ${getRatingColor(selectedReview.overall_rating)}`}>{selectedReview.overall_rating?.toFixed(1)}</span> - {getRatingLabel(selectedReview.overall_rating)}
              </div>
              <div>
                <strong>Strengths:</strong>
                <p className="mt-1 text-gray-700">{selectedReview.strengths}</p>
              </div>
              <div>
                <strong>Areas of Improvement:</strong>
                <p className="mt-1 text-gray-700">{selectedReview.areas_of_improvement}</p>
              </div>
              {selectedReview.comments && (
                <div>
                  <strong>Comments:</strong>
                  <p className="mt-1 text-gray-700">{selectedReview.comments}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedReview(null)}
              className="mt-6 w-full bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default Performance
