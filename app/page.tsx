'use client'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function Home() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const supabase = createClient()

  const handleAuth = async () => {
    setLoading(true)
    setError('')
    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else window.location.href = '/chat'
    } else {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name } }
      })
      if (error) setError(error.message)
      else window.location.href = '/chat'
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: '#111116' }}>
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: '#5B4FE8' }}>
            <span className="text-white text-3xl font-bold">Z</span>
          </div>
          <h1 className="text-white text-3xl font-bold tracking-tight">zova</h1>
          <p className="mt-2 text-sm" style={{ color: '#8B8B9A' }}>Connect free. Always.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: '#1E1E26' }}>
          <h2 className="text-white text-lg font-semibold mb-6">
            {isLogin ? 'Welcome back' : 'Create account'}
          </h2>

          {!isLogin && (
            <div className="mb-4">
              <label className="block text-xs font-medium mb-2" style={{ color: '#8B8B9A' }}>Full name</label>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none focus:ring-2 transition-all"
                style={{ background: '#2C2C38', border: 'none', focusRingColor: '#5B4FE8' }}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium mb-2" style={{ color: '#8B8B9A' }}>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: '#2C2C38', border: 'none' }}
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium mb-2" style={{ color: '#8B8B9A' }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
              style={{ background: '#2C2C38', border: 'none' }}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: '#2C1A1A', color: '#E8544A' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: '#5B4FE8', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Please wait...' : isLogin ? 'Sign in' : 'Create account'}
          </button>

          <p className="text-center text-sm mt-5" style={{ color: '#8B8B9A' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="font-medium"
              style={{ color: '#5B4FE8' }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </main>
  )
}