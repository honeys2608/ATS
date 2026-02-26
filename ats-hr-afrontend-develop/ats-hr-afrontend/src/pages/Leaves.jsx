import React, { useState, useEffect } from 'react'
import api from '../api/axios'

function Leaves() {
  const [leaves, setLeaves] = useState([])
  const [balances, setBalances] = useState([])
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentEmployee, setCurrentEmployee] = useState(null)
  const role = localStorage.getItem('role')

  const [formData, setFormData] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: ''
  })

  useEffect(() => {
    loadCurrentUser()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const userRes = await api.get('/auth/me')
      setCurrentEmployee(userRes.data.employee)
      if (userRes.data.employee) {
        loadData(userRes.data.employee.id)
      } else {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error loading user:', error)
      setLoading(false)
    }
  }

  const loadData = async (employeeId) => {
    try {
      const [leavesRes, balancesRes] = await Promise.all([
        api.get('/v1/leaves'),
        api.get(`/v1/leaves/balance/${employeeId}`)
      ])
      
      setLeaves(leavesRes.data)
      setBalances(balancesRes.data)
      setLoading(false)
    } catch (error) {
      console.error('Error loading data:', error)
      setLoading(false)
    }
  }

  const submitLeaveRequest = async (e) => {
    e.preventDefault()
    if (!currentEmployee) {
      alert('Employee profile not found. Please contact administrator.')
      return
    }
    try {
      await api.post('/v1/leaves', {
        employee_id: currentEmployee.id,
        ...formData
      })
      
      setShowRequestForm(false)
      setFormData({ leave_type: 'casual', start_date: '', end_date: '', reason: '' })
      loadData(currentEmployee.id)
    } catch (error) {
      console.error('Error submitting leave:', error)
      alert(error.response?.data?.detail || 'Error submitting leave request')
    }
  }

  const approveLeave = async (leaveId, status) => {
    try {
      await api.put(`/v1/leaves/${leaveId}/approve`, {
        status,
        rejection_reason: status === 'rejected' ? 'Not approved' : null
      })
      if (currentEmployee) {
        loadData(currentEmployee.id)
      }
    } catch (error) {
      console.error('Error updating leave:', error)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="max-w-7xl">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Leave Management</h1>
          <p className="text-gray-600">Manage employee leave requests and balances</p>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
        >
          + Request Leave
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {balances.map((balance) => (
          <div key={balance.leave_type} className="bg-white rounded-lg p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold capitalize">{balance.leave_type} Leave</h3>
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">{balance.available}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Allocated:</span>
                <span className="font-medium">{balance.total_allocated} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Used:</span>
                <span className="font-medium">{balance.used} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Available:</span>
                <span className="font-bold text-green-600">{balance.available} days</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showRequestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-6">Request Leave</h2>
            <form onSubmit={submitLeaveRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Leave Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows="3"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                >
                  Submit Request
                </button>
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Leave Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                {role === 'admin' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaves.map((leave) => (
                <tr key={leave.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{leave.employee_name || 'Employee'}</td>
                  <td className="px-6 py-4 text-sm capitalize">{leave.leave_type}</td>
                  <td className="px-6 py-4 text-sm">
                    {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium">{leave.days_count}</td>
                  <td className="px-6 py-4 text-sm">{leave.reason}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(leave.status)}`}>
                      {leave.status}
                    </span>
                  </td>
                  {role === 'admin' && leave.status === 'pending' && (
                    <td className="px-6 py-4 text-sm space-x-2">
                      <button
                        onClick={() => approveLeave(leave.id, 'approved')}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => approveLeave(leave.id, 'rejected')}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Leaves
