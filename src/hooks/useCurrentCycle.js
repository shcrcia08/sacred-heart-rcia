import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export function useCurrentCycle() {
  const [cycle, setCycle] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('cycles')
      .select('*')
      .eq('is_current', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setCycle(data)
          setLoading(false)
        }
      })
    return () => { active = false }
  }, [])

  return { cycle, loading }
}
