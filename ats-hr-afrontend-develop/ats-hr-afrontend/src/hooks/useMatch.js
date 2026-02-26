import { useState } from 'react'
import axios from '../api/axios'

export default function useMatch() {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function fetchMatch(jobId, limit = 10) {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.post('/v1/candidates/match', { job_id: jobId, limit })
      setResults(res.data || [])
      return res.data || []
    } catch (err) {
      console.error('Match fetch failed', err)
      setError(err?.response?.data?.detail || 'Failed to fetch matches')
      return []
    } finally {
      setLoading(false)
    }
  }

  return { results, loading, error, fetchMatch }
}
