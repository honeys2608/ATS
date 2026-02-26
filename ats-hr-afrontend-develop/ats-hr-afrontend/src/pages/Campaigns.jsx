import React, { useState, useEffect } from 'react'
import axios from '../api/axios'

function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState({})
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [filterPlatform, setFilterPlatform] = useState('all')
  
  const [newCampaign, setNewCampaign] = useState({
    job_id: '',
    platform: 'linkedin',
    campaign_name: '',
    budget: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  })

  const [metricsUpdate, setMetricsUpdate] = useState({
    impressions: '',
    clicks: '',
    applications: ''
  })

  const platforms = [
    { value: 'linkedin', label: 'LinkedIn', icon: '💼', color: 'bg-blue-500' },
    { value: 'facebook', label: 'Facebook', icon: '👥', color: 'bg-indigo-600' },
    { value: 'instagram', label: 'Instagram', icon: '📸', color: 'bg-pink-500' },
    { value: 'twitter', label: 'Twitter/X', icon: '🐦', color: 'bg-sky-500' },
    { value: 'indeed', label: 'Indeed', icon: '💼', color: 'bg-blue-700' },
    { value: 'glassdoor', label: 'Glassdoor', icon: '🏢', color: 'bg-green-600' },
    { value: 'google', label: 'Google Ads', icon: '🔍', color: 'bg-red-500' }
  ]

  useEffect(() => {
    loadData()
  }, [filterPlatform])

  const loadData = async () => {
    try {
      const params = filterPlatform !== 'all' ? { platform: filterPlatform } : {}
      const [campaignsRes, jobsRes, metricsRes] = await Promise.all([
        axios.get('/v1/campaigns', { params }),
        axios.get('/v1/jobs'),
        axios.get('/v1/campaigns/dashboard/metrics')
      ])
      setCampaigns(campaignsRes.data || [])
      setJobs(jobsRes.data || [])
      setMetrics(metricsRes.data || {})
      setLoading(false)
    } catch (error) {
      console.error('Error loading campaigns:', error)
      setLoading(false)
    }
  }

  const createCampaign = async () => {
    try {
      await axios.post('/v1/campaigns', null, {
        params: {
          job_id: newCampaign.job_id,
          platform: newCampaign.platform,
          campaign_name: newCampaign.campaign_name,
          budget: parseFloat(newCampaign.budget) || 0,
          start_date: newCampaign.start_date,
          end_date: newCampaign.end_date || null
        }
      })
      setShowCreateModal(false)
      setNewCampaign({ job_id: '', platform: 'linkedin', campaign_name: '', budget: '', start_date: new Date().toISOString().split('T')[0], end_date: '' })
      loadData()
    } catch (error) {
      console.error('Error creating campaign:', error)
    }
  }

  const updateMetrics = async () => {
    try {
      await axios.put(`/v1/campaigns/${selectedCampaign.id}/metrics`, null, {
        params: {
          impressions: parseInt(metricsUpdate.impressions) || undefined,
          clicks: parseInt(metricsUpdate.clicks) || undefined,
          applications: parseInt(metricsUpdate.applications) || undefined
        }
      })
      setShowMetricsModal(false)
      setSelectedCampaign(null)
      loadData()
    } catch (error) {
      console.error('Error updating metrics:', error)
    }
  }

  const updateStatus = async (campaignId, status) => {
    try {
      await axios.put(`/v1/campaigns/${campaignId}/status`, null, {
        params: { status }
      })
      loadData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const openMetricsModal = (campaign) => {
    setSelectedCampaign(campaign)
    setMetricsUpdate({
      impressions: campaign.impressions || '',
      clicks: campaign.clicks || '',
      applications: campaign.applications || ''
    })
    setShowMetricsModal(true)
  }

  const getPlatformInfo = (platform) => {
    return platforms.find(p => p.value === platform) || { label: platform, icon: '📱', color: 'bg-gray-500' }
  }

  const getStatusBadge = (status) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-gray-100 text-gray-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return <div className="text-center py-12">Loading campaigns...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Social Media Campaigns</h1>
          <p className="text-gray-600 mt-1">Track job advertisements across social media platforms</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition"
        >
          Create Campaign
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Total Campaigns</div>
          <div className="text-3xl font-bold mt-2">{metrics.total_campaigns || 0}</div>
          <div className="text-xs mt-2 opacity-75">{metrics.active_campaigns || 0} Active</div>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Total Budget</div>
          <div className="text-3xl font-bold mt-2">${(metrics.total_budget || 0).toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Total Impressions</div>
          <div className="text-3xl font-bold mt-2">{(metrics.total_impressions || 0).toLocaleString()}</div>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
          <div className="text-sm opacity-90">Applications</div>
          <div className="text-3xl font-bold mt-2">{metrics.total_applications || 0}</div>
          <div className="text-xs mt-2 opacity-75">CTR: {metrics.average_ctr || 0}%</div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex gap-3 overflow-x-auto">
          <button
            onClick={() => setFilterPlatform('all')}
            className={`px-4 py-2 rounded whitespace-nowrap ${filterPlatform === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            All Platforms
          </button>
          {platforms.map(platform => (
            <button
              key={platform.value}
              onClick={() => setFilterPlatform(platform.value)}
              className={`px-4 py-2 rounded whitespace-nowrap ${filterPlatform === platform.value ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              {platform.icon} {platform.label}
            </button>
          ))}
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <p className="text-gray-500 text-lg">No campaigns found</p>
          <p className="text-gray-400 mt-2">Create your first social media campaign to start tracking job advertisements</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Job</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platform</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Budget</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Impressions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Applications</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CTR</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => {
                const platformInfo = getPlatformInfo(campaign.platform)
                return (
                  <tr key={campaign.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{campaign.campaign_name}</div>
                      <div className="text-xs text-gray-500">{campaign.utm_campaign}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{campaign.job_title}</div>
                      <div className="text-xs text-gray-500">{campaign.job_location}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold text-white ${platformInfo.color}`}>
                        {platformInfo.icon} {platformInfo.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold">${campaign.budget?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">{campaign.impressions?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm">{campaign.clicks?.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-green-600">{campaign.applications}</td>
                    <td className="px-6 py-4 text-sm">{campaign.click_through_rate}%</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadge(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openMetricsModal(campaign)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Update
                        </button>
                        {campaign.status === 'active' && (
                          <button
                            onClick={() => updateStatus(campaign.id, 'paused')}
                            className="text-yellow-600 hover:text-yellow-900"
                          >
                            Pause
                          </button>
                        )}
                        {campaign.status === 'paused' && (
                          <button
                            onClick={() => updateStatus(campaign.id, 'active')}
                            className="text-green-600 hover:text-green-900"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Create Social Media Campaign</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Job Position</label>
                <select
                  value={newCampaign.job_id}
                  onChange={(e) => setNewCampaign({...newCampaign, job_id: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  <option value="">Select Job</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title} - {job.location}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Platform</label>
                <select
                  value={newCampaign.platform}
                  onChange={(e) => setNewCampaign({...newCampaign, platform: e.target.value})}
                  className="w-full p-2 border rounded"
                >
                  {platforms.map(platform => (
                    <option key={platform.value} value={platform.value}>
                      {platform.icon} {platform.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={newCampaign.campaign_name}
                  onChange={(e) => setNewCampaign({...newCampaign, campaign_name: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="Summer 2024 Hiring Drive"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Budget ($)</label>
                <input
                  type="number"
                  value={newCampaign.budget}
                  onChange={(e) => setNewCampaign({...newCampaign, budget: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder="1000"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">Start Date</label>
                  <input
                    type="date"
                    value={newCampaign.start_date}
                    onChange={(e) => setNewCampaign({...newCampaign, start_date: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">End Date</label>
                  <input
                    type="date"
                    value={newCampaign.end_date}
                    onChange={(e) => setNewCampaign({...newCampaign, end_date: e.target.value})}
                    className="w-full p-2 border rounded"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={createCampaign} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Create Campaign
              </button>
              <button onClick={() => setShowCreateModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showMetricsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Update Campaign Metrics</h2>
            <p className="text-gray-600 mb-4">Campaign: <strong>{selectedCampaign?.campaign_name}</strong></p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Impressions</label>
                <input
                  type="number"
                  value={metricsUpdate.impressions}
                  onChange={(e) => setMetricsUpdate({...metricsUpdate, impressions: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder={selectedCampaign?.impressions || '0'}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Clicks</label>
                <input
                  type="number"
                  value={metricsUpdate.clicks}
                  onChange={(e) => setMetricsUpdate({...metricsUpdate, clicks: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder={selectedCampaign?.clicks || '0'}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Applications Received</label>
                <input
                  type="number"
                  value={metricsUpdate.applications}
                  onChange={(e) => setMetricsUpdate({...metricsUpdate, applications: e.target.value})}
                  className="w-full p-2 border rounded"
                  placeholder={selectedCampaign?.applications || '0'}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={updateMetrics} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
                Update Metrics
              </button>
              <button onClick={() => setShowMetricsModal(false)} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Campaigns
