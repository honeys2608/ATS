import React, { useEffect, useState } from 'react'
import axios from '../api/axios'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function RecruiterDashboard() {
  const { user } = useAuth()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [candidatesMap, setCandidatesMap] = useState({})
  const [notifications, setNotifications] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    let mounted = true
    setLoading(true)
    axios
      .get('/v1/jobs?assigned_to=me')
      .then((r) => {
        if (!mounted) return
        const list = r.data || []
        setJobs(list)

        // fetch counts per job
        return Promise.all(
          list.map((j) =>
            axios
              .get(`/v1/jobs/${j.id}/candidates`)
              .then((res) => ({ jobId: j.id, data: res.data }))
              .catch(() => ({ jobId: j.id, data: { total_candidates: 0 } }))
          )
        )
      })
      .then((results) => {
        if (!mounted || !results) return
        const map = {}
        results.forEach((r) => (map[r.jobId] = r.data))
        setCandidatesMap(map)
      })
      .catch((err) => console.error('Failed to load recruiter jobs', err))
      .finally(() => mounted && setLoading(false))

    // notifications
    axios
      .get('/v1/notifications')
      .then((r) => { if (mounted) setNotifications(r.data?.notifications || []) })
      .catch(() => {})

    return () => {
      mounted = false
    }
  }, [user?.id])

  if (loading) return <div>Loading recruiter dashboard...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Recruiter Dashboard</h1>
        <div className="text-sm text-gray-500">Assigned to you</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-3">My Assigned Jobs ({jobs.length})</h3>
          {jobs.length === 0 ? (
            <p className="text-sm text-gray-500">No assigned jobs.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map((j) => (
                <div key={j.id} className="p-3 border rounded flex items-center justify-between">
                  <div>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-gray-500">{j.location || 'Remote'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-600">Candidates: <span className="font-semibold">{candidatesMap[j.id]?.total_candidates ?? (candidatesMap[j.id]?.candidates?.length ?? 0)}</span></div>
                    <button onClick={() => navigate(`/recruitment/jobs/${j.id}/submissions`)} className="px-3 py-1 border rounded text-sm">View</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="font-semibold mb-3">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No notifications.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n, idx) => (
                <div key={n.id ?? idx} className="p-2 border rounded">
                  <div className="font-medium">{n.title || n.message}</div>
                  <div className="text-xs text-gray-500">{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
