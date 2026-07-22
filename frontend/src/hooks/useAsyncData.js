import { useEffect, useState } from 'react'

export function useAsyncData(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, isLoading: true, error: null })
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, isLoading: true, error: null }))

    loader()
      .then((data) => {
        if (active) setState({ data, isLoading: false, error: null })
      })
      .catch((error) => {
        if (active) setState({ data: null, isLoading: false, error })
      })

    return () => {
      active = false
    }
    // loader is intentionally supplied by each screen and refreshed by requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, requestKey])

  return {
    ...state,
    reload: () => setRequestKey((value) => value + 1),
  }
}