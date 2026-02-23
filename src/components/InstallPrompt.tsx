import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Check if already dismissed
    if (localStorage.getItem('pwa-install-dismissed')) {
      return
    }

    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault()
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e)
      // Update UI to notify the user they can add to home screen
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the prompt
    deferredPrompt.prompt()
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt')
    } else {
      console.log('User dismissed the A2HS prompt')
    }
    
    setDeferredPrompt(null)
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  if (!showPrompt) return null

  return (
    <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-md relative z-50">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-slate-800 rounded-lg">
          <Download size={20} className="text-blue-400" />
        </div>
        <div>
          <p className="font-semibold text-sm">Install Distribute</p>
          <p className="text-xs text-slate-400">Get faster access and offline capabilities</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleInstallClick}
          className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-full transition-colors"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
