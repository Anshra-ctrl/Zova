'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) window.location.href = '/'
      else { setUser(user); setLoading(false) }
    }
    getUser()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#111116' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ background: '#5B4FE8' }}>
          <span className="text-white font-bold text-lg">Z</span>
        </div>
        <p className="text-sm" style={{ color: '#8B8B9A' }}>Loading...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen" style={{ background: '#111116' }}>
      <div className="w-80 flex flex-col border-r" style={{ background: '#111116', borderColor: '#2C2C38' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#2C2C38' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#5B4FE8' }}>
              <span className="text-white font-bold text-sm">Z</span>
            </div>
            <span className="text-white font-semibold text-lg">zova</span>
          </div>
          <button onClick={handleSignOut} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#8B8B9A', background: '#1E1E26' }}>
            Sign out
          </button>
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#1E1E26' }}>
            <span style={{ color: '#8B8B9A' }}>🔍</span>
            <input placeholder="Search" className="bg-transparent text-sm outline-none flex-1" style={{ color: '#8B8B9A' }} />
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: '#1E1E26' }}>
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-sm font-medium text-white mb-1">No chats yet</p>
          <p className="text-xs" style={{ color: '#8B8B9A' }}>Start a new conversation</p>
        </div>
        <div className="p-4">
          <button className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: '#5B4FE8' }}>
            + New chat
          </button>
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center" style={{ background: '#0D0D12' }}>
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: '#1E1E26' }}>
            <span className="text-4xl">💬</span>
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">Welcome to Zova</h2>
          <p className="text-sm max-w-xs" style={{ color: '#8B8B9A' }}>Select a chat or start a new one</p>
          <p className="text-xs mt-4 px-3 py-2 rounded-lg inline-block" style={{ color: '#57C285', background: '#0D2318' }}>
            ● Signed in as {user?.email}
          </p>
        </div>
      </div>
    </div>
  )
}