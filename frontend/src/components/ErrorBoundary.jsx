import { Component } from 'react'

// Detects the "stale chunk after a new deploy" class of errors. When the app
// is redeployed, hashed chunk filenames change; a browser holding the old
// index.html will fail to dynamically import the now-missing chunk.
function isChunkLoadError(error) {
  const msg = `${error?.name || ''} ${error?.message || ''}`
  return (
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

const RELOAD_FLAG = 'afcc_chunk_reloaded'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    // Stale-chunk crash → reload ONCE to pull the fresh index.html + chunks.
    // The sessionStorage guard prevents an infinite reload loop if the reload
    // doesn't fix it (e.g. a genuine bug rather than a stale deploy).
    if (isChunkLoadError(error) && !sessionStorage.getItem(RELOAD_FLAG)) {
      sessionStorage.setItem(RELOAD_FLAG, '1')
      window.location.reload()
    }
  }

  handleReload = () => {
    sessionStorage.removeItem(RELOAD_FLAG)
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      // If it's a chunk error we're already reloading; show a neutral spinner.
      if (isChunkLoadError(this.state.error) && sessionStorage.getItem(RELOAD_FLAG)) {
        return (
          <div className="flex items-center justify-center h-screen">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <h1 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-500 mb-6">
              The page failed to load. This usually clears after a refresh.
            </p>
            <button onClick={this.handleReload} className="btn-primary w-full justify-center py-2.5">
              Reload the app
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Clear the one-shot reload guard after a successful render, so a future
// deploy can trigger its own single reload.
export function clearChunkReloadFlag() {
  try { sessionStorage.removeItem(RELOAD_FLAG) } catch { /* ignore */ }
}
