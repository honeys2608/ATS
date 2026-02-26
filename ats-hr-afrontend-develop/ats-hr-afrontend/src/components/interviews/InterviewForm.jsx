// src/components/interviews/InterviewForm.jsx
import React, { useState } from 'react'
import PropTypes from 'prop-types'
import axios from '../../api/axios'

export default function InterviewForm({
  candidateId = '',
  jobId = '',
  candidates = [],     // optional: list to show when candidateId not provided
  jobs = [],           // optional: list to show when jobId not provided
  onSuccess
}) {
  const [type, setType] = useState('phone') // phone | video | in-person
  const [scheduledAt, setScheduledAt] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const isStandalone = !candidateId || !jobId

  // basic future-datetime validation
  function isFutureDatetime(dtLocal) {
    if (!dtLocal) return false
    // dtLocal comes as "YYYY-MM-DDTHH:mm"
    const t = new Date(dtLocal)
    return t.getTime() > Date.now()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    const selectedCandidate = candidateId || e.target.candidate_id?.value
    const selectedJob = jobId || e.target.job_id?.value

    if (!selectedCandidate || !selectedJob) {
      setError('Candidate and Job are required.')
      return
    }
    if (!scheduledAt) {
      setError('Please select a scheduled time.')
      return
    }
    if (!isFutureDatetime(scheduledAt)) {
      setError('Scheduled time must be in the future.')
      return
    }

    setSubmitting(true)
    try {
      // payload expects scheduled_at in ISO format — backend should accept the ISO date string
      // new Date(scheduledAt).toISOString() converts local datetime to UTC ISO string
      const payload = {
        candidate_id: selectedCandidate,
        job_id: selectedJob,
        type,
        scheduled_at: new Date(scheduledAt).toISOString(),
        location: location || undefined,
        notes: notes || undefined
      }

      // NOTE: axios instance (src/api/axios) should attach the Authorization header via interceptor.
      // If you DO NOT have an interceptor, re-add headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      const res = await axios.post('/v1/interviews', payload)

      // call onSuccess with created interview object
      onSuccess && onSuccess(res.data)

      // reset only when used as standalone form (so candidate/job props not lost)
      if (isStandalone) {
        setType('phone')
        setScheduledAt('')
        setLocation('')
        setNotes('')
      }
    } catch (err) {
      console.error('Schedule error', err)
      const serverMsg = err?.response?.data?.message || err?.response?.data?.detail
      setError(serverMsg || 'Failed to schedule interview. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Schedule interview form" className="space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{error}</div>}

      {/* Candidate select if candidateId not provided */}
      {isStandalone && (
        <label className="block">
          <div className="text-sm font-medium mb-1">Candidate</div>
          <select name="candidate_id" defaultValue={candidateId} className="w-full p-2 border rounded" required>
            <option value="">Select candidate</option>
            {candidates.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>)}
          </select>
        </label>
      )}

      {/* Job select if jobId not provided */}
      {isStandalone && (
        <label className="block">
          <div className="text-sm font-medium mb-1">Job Position</div>
          <select name="job_id" defaultValue={jobId} className="w-full p-2 border rounded" required>
            <option value="">Select job</option>
            {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
      )}

      <label className="block">
        <div className="text-sm font-medium mb-1">Interview Type</div>
        <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2 border rounded">
          <option value="phone">Phone</option>
          <option value="video">Video</option>
          <option value="in-person">In-person</option>
        </select>
      </label>

      <label className="block">
        <div className="text-sm font-medium mb-1">Scheduled Time</div>
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={e => setScheduledAt(e.target.value)}
          className="w-full p-2 border rounded"
          required
          aria-required="true"
        />
        <p className="text-xs text-gray-500 mt-1">Local time will be converted to UTC for storage.</p>
      </label>

      {type === 'in-person' && (
        <label className="block">
          <div className="text-sm font-medium mb-1">Location</div>
          <input value={location} onChange={e => setLocation(e.target.value)} className="w-full p-2 border rounded" />
        </label>
      )}

      <label className="block">
        <div className="text-sm font-medium mb-1">Notes (optional)</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded" rows={3} />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {submitting ? 'Scheduling...' : 'Schedule Interview'}
        </button>

        <button
          type="button"
          onClick={() => {
            setType('phone'); setScheduledAt(''); setLocation(''); setNotes(''); setError(null)
          }}
          className="bg-gray-200 px-4 py-2 rounded"
        >
          Reset
        </button>
      </div>
    </form>
  )
}

InterviewForm.propTypes = {
  candidateId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  jobId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  candidates: PropTypes.array,
  jobs: PropTypes.array,
  onSuccess: PropTypes.func
}
