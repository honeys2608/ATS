// src/components/recruitment/MatchCandidateModal.jsx
import React, { useEffect, useState } from 'react'
import { matchCandidates } from '../../services/jobService'

// Minimal modal (no external modal lib). Props: open, onClose, jobId, onPromote callback
export default function MatchCandidateModal({ open, onClose, jobId, onPromote }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !jobId) return
    let mounted = true
    setLoading(true)
    setError('')
    matchCandidates(jobId)
      .then(r => {
        if (!mounted) return
        setMatches(r.data ?? [])
      })
      .catch(e => {
        console.error(e)
        setError('Failed to get matches')
      })
      .finally(() => mounted && setLoading(false))
    return () => { mounted = false }
  }, [open, jobId])

  if (!open) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60
    }}>
      <div style={{ width: '90%', maxWidth: 900, background: '#fff', borderRadius: 8, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="text-lg font-semibold">Candidate Matches</h3>
          <button onClick={onClose} className="px-3 py-1 border rounded">Close</button>
        </div>

        {loading ? (
          <div className="py-6 text-center">Running match...</div>
        ) : error ? (
          <div className="text-red-600 mt-4">{error}</div>
        ) : matches.length === 0 ? (
          <div className="py-6 text-center text-gray-500">No matches returned</div>
        ) : (
          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {matches.map(m => (
              <div key={m.candidate_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, border: '1px solid #eee', borderRadius: 6 }}>
                <div>
                  <div className="font-medium">{m.full_name || m.name || 'Candidate'}</div>
                  <div className="text-xs text-gray-500">{m.email}</div>
                  <div className="text-sm mt-1">Fit score: {typeof m.fit_score === 'number' ? m.fit_score.toFixed(2) : m.fit_score}</div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <a href={m.resume_url} target="_blank" rel="noreferrer" className="px-3 py-1 border rounded text-sm">Resume</a>
                  <button
                    className="px-3 py-1 bg-indigo-600 text-white rounded text-sm"
                    onClick={() => {
                      // onPromote should call backend to create JobApplication / submission
                      if (onPromote) onPromote(m)
                    }}
                  >
                    Promote
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
