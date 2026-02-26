import React, { useState, useEffect } from 'react'
import axios from '../api/axios'

function Leads() {
  const [leads, setLeads] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [jobs, setJobs] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  
  const [formData, setFormData] = useState({
    campaign_id: '',
    full_name: '',
    email: '',
    phone: '',
    location: '',
    linkedin_url: '',
    source: 'linkedin'
  })
  
  const [convertJobId, setConvertJobId] = useState('')

  useEffect(() => {
    loadData()
  }, [filterStatus, filterSource])

  const loadData = async () => {
    try {
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterSource) params.source = filterSource
      
      const [leadsRes, campaignsRes, jobsRes, analyticsRes] = await Promise.all([
        axios.get('/v1/leads/', { params }),
        axios.get('/v1/leads/campaigns'),
        axios.get('/v1/jobs'),
        axios.get('/v1/leads/analytics')
      ])
      
      setLeads(leadsRes.data || [])
      setCampaigns(campaignsRes.data || [])
      setJobs(jobsRes.data || [])
      setAnalytics(analyticsRes.data)
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleCreateLead = async (e) => {
    e.preventDefault()
    try {
      await axios.post('/v1/leads/', formData)
      setShowCreateModal(false)
      setFormData({
        campaign_id: '',
        full_name: '',
        email: '',
        phone: '',
        location: '',
        linkedin_url: '',
        source: 'linkedin'
      })
      loadData()
    } catch (error) {
      console.error('Error creating lead:', error)
      alert(error.response?.data?.detail || 'Error creating lead')
    }
  }

  const handleConvertLead = async () => {
    if (!convertJobId) {
      alert('Please select a job position')
      return
    }
    
    try {
      await axios.post('/v1/leads/convert-to-applicant', null, {
        params: {
          lead_id: selectedLead.id,
          job_id: convertJobId
        }
      })
      
      setShowConvertModal(false)
      setSelectedLead(null)
      setConvertJobId('')
      loadData()
      alert('Lead converted to applicant successfully!')
    } catch (error) {
      console.error('Error converting lead:', error)
      alert(error.response?.data?.detail || 'Error converting lead')
    }
  }

  const getStatusBadge = (status) => {
    const styles = {
      new: 'bg-blue-100 text-blue-800',
      qualified: 'bg-green-100 text-green-800',
      contacted: 'bg-yellow-100 text-yellow-800',
      converted: 'bg-purple-100 text-purple-800',
      rejected: 'bg-red-100 text-red-800'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status?.toUpperCase() || 'NEW'}
      </span>
    )
  }

  const getSourceIcon = (source) => {
    const icons = {
      linkedin: '💼',
      facebook: '👥',
      instagram: '📸',
      twitter: '🐦',
      indeed: '💼',
      direct: '🔗',
      referral: '🤝'
    }
    return icons[source] || '🌐'
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lead Management</h1>
        <p className="text-gray-600">Track and manage leads from your marketing campaigns</p>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl font-bold mb-1">{analytics.total_leads}</div>
            <div className="text-blue-100 text-sm">Total Leads</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 text-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl font-bold mb-1">{analytics.qualified_leads}</div>
            <div className="text-green-100 text-sm">Qualified Leads</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl font-bold mb-1">{analytics.converted_leads}</div>
            <div className="text-purple-100 text-sm">Converted to Applicants</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white p-6 rounded-xl shadow-lg">
            <div className="text-3xl font-bold mb-1">{analytics.conversion_rate}%</div>
            <div className="text-orange-100 text-sm">Conversion Rate</div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="bg-white p-6 rounded-xl shadow-sm mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Status</option>
                <option value="new">New</option>
                <option value="qualified">Qualified</option>
                <option value="contacted">Contacted</option>
                <option value="converted">Converted</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Sources</option>
                <option value="linkedin">LinkedIn</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter</option>
                <option value="indeed">Indeed</option>
                <option value="direct">Direct</option>
                <option value="referral">Referral</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Lead Info
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {leads.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-lg font-medium">No leads found</p>
                  <p className="text-sm">Leads from your campaigns will appear here</p>
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{lead.full_name || 'N/A'}</div>
                    {lead.location && <div className="text-sm text-gray-500">{lead.location}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{lead.email}</div>
                    {lead.phone && <div className="text-sm text-gray-500">{lead.phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{getSourceIcon(lead.source)}</span>
                      <span className="text-sm text-gray-700 capitalize">{lead.source || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(lead.status)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="text-lg font-semibold text-blue-600">{lead.score || 0}</div>
                      <div className="text-sm text-gray-500 ml-1">/100</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {lead.status !== 'converted' && (
                      <button
                        onClick={() => {
                          setSelectedLead(lead)
                          setShowConvertModal(true)
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
                      >
                        Convert to Applicant
                      </button>
                    )}
                    {lead.status === 'converted' && (
                      <span className="text-sm text-gray-500 italic">Converted ✓</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Lead</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Campaign (Optional)</label>
                    <select
                      value={formData.campaign_id}
                      onChange={(e) => setFormData({ ...formData, campaign_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No Campaign</option>
                      {campaigns.map(campaign => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.campaign_name} ({campaign.platform})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">LinkedIn URL</label>
                    <input
                      type="url"
                      value={formData.linkedin_url}
                      onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
                    <select
                      value={formData.source}
                      onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="linkedin">LinkedIn</option>
                      <option value="facebook">Facebook</option>
                      <option value="instagram">Instagram</option>
                      <option value="twitter">Twitter</option>
                      <option value="indeed">Indeed</option>
                      <option value="direct">Direct</option>
                      <option value="referral">Referral</option>
                    </select>
                  </div>
                </div>
                
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                  >
                    Add Lead
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Convert Lead Modal */}
      {showConvertModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Convert Lead to Applicant</h2>
              <p className="text-gray-600 mb-6">
                Converting <span className="font-semibold">{selectedLead.full_name}</span> to a job applicant.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Job Position *</label>
                <select
                  value={convertJobId}
                  onChange={(e) => setConvertJobId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a job...</option>
                  {jobs.filter(j => j.status === 'open').map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.location}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowConvertModal(false)
                    setSelectedLead(null)
                    setConvertJobId('')
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConvertLead}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                >
                  Convert
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Leads
