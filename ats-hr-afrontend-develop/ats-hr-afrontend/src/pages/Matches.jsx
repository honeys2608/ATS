import React, { useState } from 'react'
import useMatch from '../hooks/useMatch'
import axios from '../api/axios'

export default function Matches() {
  const [jobId, setJobId] = useState('')
  const [jobs, setJobs] = useState([])
  const { results, loading, error, fetchMatch } = useMatch()

  // load jobs quickly (on mount)
  React.useEffect(() => {
    axios.get('/v1/jobs').then(r => setJobs(Array.isArray(r.data) ? r.data : (r.data.items ?? []))).catch(console.error)
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Candidate Matches</h1>

      <div className="mb-4">
        <label className="block mb-2">Select job</label>
        <select value={jobId} onChange={e => setJobId(e.target.value)} className="border p-2 rounded">
          <option value="">Select a job</option>
          {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
        <button disabled={!jobId} onClick={() => fetchMatch(jobId, 10)} className="ml-3 bg-indigo-600 text-white px-3 py-2 rounded">Find Matches</button>
      </div>

      {loading && <p>Searching...</p>}
      {error && <p className="text-red-600">{error}</p>}

      <div className="space-y-3">
        {results.map(r => (
          <div key={r.candidate_id} className="p-4 border rounded">
            <div className="flex justify-between">
              <div>
                <p className="font-semibold">{r.candidate_name ?? r.candidate_id}</p>
                <p className="text-sm text-gray-600">{r.top_factors?.join(', ')}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold">{Number(r.fit_score).toFixed(1)}</div>
                <div className="text-sm text-gray-500">Fit score</div>
              </div>
            </div>
            {r.explanation && <p className="text-sm mt-2 text-gray-700">{r.explanation}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
