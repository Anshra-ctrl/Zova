'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

const INDIGO = '#5B4FE8'
const BG = '#111116'
const BG2 = '#18181F'
const BG3 = '#202028'
const SAGE = '#8FBF9F'
const BORDER = 'rgba(255,255,255,0.07)'
const T1 = '#F4F4F6'
const T2 = '#9C9CA8'
const T3 = '#5C5C66'
const BUBBLE_IN = '#1F1F28'

const palette = ['#5B4FE8','#7A6EF0','#8FBF9F','#C77B5A','#6FA88A','#9B7FE8']
const colorFor = (s: string) => palette[(s||'').split('').reduce((a,c)=>a+c.charCodeAt(0),0) % palette.length]
const initials = (s: string) => (s||'?').trim().slice(0,2).toUpperCase()
const fmtTime = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) { let h=d.getHours()%12||12; return `${h}:${d.getMinutes().toString().padStart(2,'0')} ${d.getHours()>=12?'PM':'AM'}` }
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
}

type Profile = { id: string; username: string; display_name: string; avatar_color: string }
type Message = { id: string; conversation_id: string; sender_id: string; content: string; created_at: string }
type ConvMeta = { id: string; name: string; username: string; color: string; lastText: string; lastTime: string; unread: number; otherUserId: string | null }

export default function ChatPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [convs, setConvs] = useState<ConvMeta[]>([])
  const [activeConv, setActiveConv] = useState<ConvMeta | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [view, setView] = useState<'list'|'chat'|'newchat'|'settings'>('list')
  const [newChatUser, setNewChatUser] = useState('')
  const [newChatMsg, setNewChatMsg] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const msgEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/'; return }
      setUser(user)
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(p)
      setLoading(false)
      loadConvs(user.id)
    }
    init()
  }, [])

  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const loadConvs = async (uid: string) => {
    const { data: rows } = await supabase.from('conversation_members')
      .select('conversation_id, last_read_at, conversations(id,is_group,name)')
      .eq('user_id', uid)
    if (!rows?.length) { setConvs([]); return }
    const enriched = await Promise.all(rows.map(async (row: any) => {
      const conv = row.conversations
      const [{ data: others }, { data: lastMsgs }] = await Promise.all([
        supabase.from('conversation_members').select('user_id, profiles(display_name,username,avatar_color)').eq('conversation_id', conv.id).neq('user_id', uid),
        supabase.from('messages').select('content,created_at,sender_id').eq('conversation_id', conv.id).order('created_at',{ascending:false}).limit(1)
      ])
      const other = others?.[0]?.profiles as any
      const last = lastMsgs?.[0]
      let unread = 0
      if (last && last.sender_id !== uid && new Date(last.created_at) > new Date(row.last_read_at)) {
        const { count } = await supabase.from('messages').select('id',{count:'exact',head:true}).eq('conversation_id',conv.id).neq('sender_id',uid).gt('created_at',row.last_read_at)
        unread = count || 1
      }
      return {
        id: conv.id,
        name: conv.is_group ? (conv.name||'Group') : (other?.display_name || 'Unknown'),
        username: other?.username || '',
        color: conv.is_group ? '#7A6EF0' : (other?.avatar_color || colorFor(conv.id)),
        lastText: last ? last.content : 'Say hi 👋',
        lastTime: last ? last.created_at : conv.created_at,
        unread,
        otherUserId: others?.[0]?.user_id || null
      } as ConvMeta
    }))
    enriched.sort((a,b) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime())
    setConvs(enriched)
  }

  const openConv = async (conv: ConvMeta) => {
    setActiveConv(conv)
    setView('chat')
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conv.id).order('created_at',{ascending:true})
    setMessages(data || [])
    await supabase.from('conversation_members').update({last_read_at: new Date().toISOString()}).eq('conversation_id',conv.id).eq('user_id',user.id)
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    channelRef.current = supabase.channel('msgs:'+conv.id)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`conversation_id=eq.${conv.id}`}, p => {
        setMessages(m => [...m, p.new as Message])
        if (p.new.sender_id !== user.id) supabase.from('conversation_members').update({last_read_at:new Date().toISOString()}).eq('conversation_id',conv.id).eq('user_id',user.id)
      }).subscribe()
    setTimeout(() => inputRef.current?.focus(), 300)
  }

  const sendMsg = async () => {
    if (!input.trim() || !activeConv) return
    const text = input.trim()
    setInput('')
    await supabase.from('messages').insert({conversation_id: activeConv.id, sender_id: user.id, content: text})
    loadConvs(user.id)
  }

  const startNewChat = async () => {
    setNewChatMsg('')
    if (!newChatUser.trim()) { setNewChatMsg('Enter a username'); return }
    if (newChatUser.toLowerCase() === profile?.username?.toLowerCase()) { setNewChatMsg("That's your own username"); return }
    const { data: other } = await supabase.from('profiles').select('*').ilike('username', newChatUser.trim()).maybeSingle()
    if (!other) { setNewChatMsg('No one found with that username'); return }
    const { data: mine } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id)
    const myIds = (mine||[]).map((r:any) => r.conversation_id)
    if (myIds.length) {
      const { data: shared } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', other.id).in('conversation_id', myIds)
      if (shared?.length) {
        const existing = convs.find(c => c.id === shared[0].conversation_id) || { id: shared[0].conversation_id, name: other.display_name, username: other.username, color: other.avatar_color||INDIGO, lastText:'', lastTime: new Date().toISOString(), unread:0, otherUserId: other.id }
        setNewChatUser(''); setView('list')
        await loadConvs(user.id)
        openConv(existing as ConvMeta)
        return
      }
    }
    const { data: newConv } = await supabase.from('conversations').insert({is_group:false}).select().single()
    if (!newConv) { setNewChatMsg('Something went wrong'); return }
    await supabase.from('conversation_members').insert([{conversation_id:newConv.id,user_id:user.id},{conversation_id:newConv.id,user_id:other.id}])
    setNewChatUser(''); setView('list')
    await loadConvs(user.id)
    openConv({id:newConv.id, name:other.display_name, username:other.username, color:other.avatar_color||INDIGO, lastText:'', lastTime:new Date().toISOString(), unread:0, otherUserId:other.id})
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); window.location.href='/' }

  const filteredConvs = convs.filter(c => c.name.toLowerCase().includes(searchQ.toLowerCase()) || c.username.toLowerCase().includes(searchQ.toLowerCase()))

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:BG}}>
      <div style={{textAlign:'center'}}>
        <div style={{width:52,height:52,borderRadius:16,background:INDIGO,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
          <svg viewBox="0 0 100 100" width="30" height="30"><polygon points="16,80 16,98 34,80" fill="#fff"/><path d="M30 28 L70 28 L30 68 L70 68" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
        <p style={{color:T3,fontSize:13}}>Loading…</p>
      </div>
    </div>
  )

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  return (
    <div style={{display:'flex',height:'100vh',background:BG,fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",overflow:'hidden'}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:4px}
        input::placeholder{color:${T3}} textarea::placeholder{color:${T3}}
        .chat-row:hover{background:rgba(255,255,255,0.04)!important}
        .nav-btn:hover{color:${T1}!important}
        .send-btn:hover{background:#4A3FC4!important}
        .icon-btn:hover{background:rgba(255,255,255,0.08)!important}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .bubble{animation:fadeUp 0.18s ease}
        @keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}
      `}</style>

      {/* ── SIDEBAR ── */}
      <div style={{
        width: isMobile && view === 'chat' ? '0' : isMobile ? '100%' : '320px',
        minWidth: isMobile && view === 'chat' ? 0 : undefined,
        display: isMobile && view === 'chat' ? 'none' : 'flex',
        flexDirection:'column', background:BG, borderRight:`0.5px solid ${BORDER}`, flexShrink:0, transition:'width 0.2s'
      }}>
        {/* Sidebar header */}
        <div style={{padding:'18px 16px 10px',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
          {view === 'newchat' ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button className="icon-btn" onClick={()=>setView('list')} style={{background:'none',border:'none',cursor:'pointer',padding:6,borderRadius:10,display:'flex',color:T2}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span style={{color:T1,fontWeight:700,fontSize:17}}>New chat</span>
            </div>
          ) : view === 'settings' ? (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <button className="icon-btn" onClick={()=>setView('list')} style={{background:'none',border:'none',cursor:'pointer',padding:6,borderRadius:10,display:'flex',color:T2}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <span style={{color:T1,fontWeight:700,fontSize:17}}>Settings</span>
            </div>
          ) : (
            <>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:32,height:32,borderRadius:10,background:INDIGO,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg viewBox="0 0 100 100" width="18" height="18"><polygon points="16,80 16,98 34,80" fill="#fff"/><path d="M30 28 L70 28 L30 68 L70 68" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{color:T1,fontWeight:800,fontSize:18,letterSpacing:'-0.3px'}}>zova</span>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="icon-btn" onClick={()=>setView('newchat')} style={{width:34,height:34,borderRadius:10,background:BG3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T1}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/></svg>
                </button>
                <button className="icon-btn" onClick={()=>setView('settings')} style={{width:34,height:34,borderRadius:10,background:BG3,border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:T1}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M4 20C4 16.69 7.58 14 12 14C16.42 14 20 16.69 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* New chat form */}
        {view === 'newchat' && (
          <div style={{padding:'8px 16px',flex:1,display:'flex',flexDirection:'column',gap:12}}>
            <p style={{color:T2,fontSize:13,margin:0,lineHeight:1.5}}>Enter the exact username of someone on zova.</p>
            <input
              autoFocus value={newChatUser} onChange={e=>setNewChatUser(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&startNewChat()}
              placeholder="username" style={{background:BG3,border:`0.5px solid ${BORDER}`,borderRadius:13,padding:'13px 16px',color:T1,fontSize:15,outline:'none',width:'100%'}}
            />
            {newChatMsg && <p style={{color:'#E87E7D',fontSize:13,margin:0}}>{newChatMsg}</p>}
            <button onClick={startNewChat} style={{background:INDIGO,color:'#fff',border:'none',borderRadius:13,padding:'13px',fontWeight:700,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
              Start chat
            </button>
          </div>
        )}

        {/* Settings */}
        {view === 'settings' && (
          <div style={{padding:'8px 16px',flex:1,display:'flex',flexDirection:'column',gap:16,overflowY:'auto'}}>
            <div style={{display:'flex',alignItems:'center',gap:14,padding:'12px 0 20px'}}>
              <div style={{width:58,height:58,borderRadius:18,background:profile?.avatar_color||INDIGO,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:20,color:'#fff',flexShrink:0}}>
                {initials(profile?.display_name||'Z')}
              </div>
              <div>
                <div style={{color:T1,fontWeight:700,fontSize:17}}>{profile?.display_name||'You'}</div>
                <div style={{color:T2,fontSize:13}}>@{profile?.username||'you'}</div>
              </div>
            </div>
            <div style={{background:BG2,borderRadius:14,overflow:'hidden'}}>
              {[['Privacy','rgba(91,79,232,0.2)','#A79BFF'],['Security','rgba(143,191,159,0.2)',SAGE],['Notifications','rgba(255,255,255,0.06)',T2]].map(([label,bg,color])=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px',borderBottom:`0.5px solid ${BORDER}`,cursor:'pointer'}}>
                  <div style={{width:28,height:28,borderRadius:8,background:bg,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:color as string}}/>
                  </div>
                  <span style={{color:T1,fontSize:14,flex:1}}>{label}</span>
                  <span style={{color:T3,fontSize:16}}>›</span>
                </div>
              ))}
            </div>
            <div style={{background:BG2,borderRadius:14,overflow:'hidden'}}>
              <button onClick={handleSignOut} style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'14px 16px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
                <div style={{width:28,height:28,borderRadius:8,background:'rgba(232,126,125,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 21H5C3.9 21 3 20.1 3 19V5C3 3.9 3.9 3 5 3H9" stroke="#E87E7D" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 17L21 12L16 7M21 12H9" stroke="#E87E7D" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span style={{color:'#E87E7D',fontSize:14}}>Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* Chat list */}
        {(view === 'list' || view === 'chat') && view !== 'newchat' && view !== 'settings' && (
          <>
            <div style={{padding:'0 16px 12px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,background:BG2,borderRadius:12,padding:'10px 14px'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={T3} strokeWidth="2.2"/><path d="M21 21L16.5 16.5" stroke={T3} strokeWidth="2.2" strokeLinecap="round"/></svg>
                <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search" style={{background:'none',border:'none',outline:'none',color:T1,fontSize:14,width:'100%'}}/>
              </div>
            </div>
            <div style={{flex:1,overflowY:'auto'}}>
              {filteredConvs.length === 0 ? (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',padding:32,textAlign:'center',gap:10}}>
                  <div style={{width:52,height:52,borderRadius:16,background:BG2,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 12C4 7.58 7.58 4 12 4C16.42 4 20 7.58 20 12C20 16.42 16.42 20 12 20C10.6 20 9.28 19.63 8.14 18.98L4 20L5.18 16.43C4.44 15.17 4 13.64 4 12Z" stroke={T3} strokeWidth="1.8" strokeLinejoin="round"/></svg>
                  </div>
                  <p style={{color:T1,fontWeight:600,fontSize:14,margin:0}}>No chats yet</p>
                  <p style={{color:T3,fontSize:13,margin:0,lineHeight:1.5}}>Tap + to start your first conversation</p>
                </div>
              ) : filteredConvs.map(c => (
                <button key={c.id} className="chat-row" onClick={()=>openConv(c)} style={{
                  display:'flex',alignItems:'center',gap:12,padding:'10px 16px',background: activeConv?.id===c.id ? 'rgba(91,79,232,0.1)' : 'transparent',
                  border:'none',width:'100%',textAlign:'left',cursor:'pointer',fontFamily:'inherit',transition:'background 0.15s'
                }}>
                  <div style={{width:48,height:48,borderRadius:15,background:c.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:15,color:'#fff',flexShrink:0}}>
                    {initials(c.name)}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:3}}>
                      <span style={{color:T1,fontWeight:600,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.name}</span>
                      <span style={{color:c.unread>0?SAGE:T3,fontSize:11.5,flexShrink:0,fontWeight:c.unread>0?700:400}}>{fmtTime(c.lastTime)}</span>
                    </div>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                      <span style={{color:T2,fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.lastText}</span>
                      {c.unread>0 && <span style={{background:INDIGO,color:'#fff',fontSize:11,fontWeight:700,minWidth:18,height:18,borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 5px',flexShrink:0}}>{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{flex:1,display: isMobile && view !== 'chat' ? 'none' : 'flex',flexDirection:'column',background:'#0D0D12',minWidth:0}}>
        {!activeConv ? (
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14,padding:40,textAlign:'center'}}>
            <div style={{width:72,height:72,borderRadius:24,background:BG2,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <svg width="32" height="32" viewBox="0 0 100 100"><polygon points="16,80 16,98 34,80" fill={INDIGO}/><path d="M30 28 L70 28 L30 68 L70 68" fill="none" stroke={INDIGO} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div>
              <p style={{color:T1,fontWeight:700,fontSize:18,margin:'0 0 6px'}}>Welcome to Zova</p>
              <p style={{color:T2,fontSize:14,margin:0}}>Pick a chat or start a new one</p>
            </div>
            <div style={{marginTop:4,padding:'8px 16px',borderRadius:10,background:'rgba(143,191,159,0.1)',display:'inline-flex',alignItems:'center',gap:6}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:SAGE,display:'inline-block'}}/>
              <span style={{color:SAGE,fontSize:12}}>{user?.email}</span>
            </div>
          </div>
        ) : (
          <>
            {/* Convo header */}
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 18px',borderBottom:`0.5px solid ${BORDER}`,flexShrink:0,background:'#0D0D12'}}>
              {isMobile && (
                <button className="icon-btn" onClick={()=>setView('list')} style={{background:'none',border:'none',cursor:'pointer',padding:6,borderRadius:10,display:'flex',color:T2}}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              )}
              <div style={{width:38,height:38,borderRadius:12,background:activeConv.color,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:13,color:'#fff',flexShrink:0}}>
                {initials(activeConv.name)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:T1,fontWeight:700,fontSize:15,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{activeConv.name}</div>
                <div style={{color:T3,fontSize:12}}>@{activeConv.username}</div>
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:'auto',padding:'16px 16px 8px',display:'flex',flexDirection:'column',gap:2}}>
              {messages.length === 0 && (
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <p style={{color:T3,fontSize:13}}>No messages yet — say something 👋</p>
                </div>
              )}
              {messages.map((m,i) => {
                const mine = m.sender_id === user.id
                const prevMine = i>0 && messages[i-1].sender_id === user.id
                const sameSender = i>0 && messages[i-1].sender_id === m.sender_id
                return (
                  <div key={m.id} className="bubble" style={{display:'flex',justifyContent:mine?'flex-end':'flex-start',marginTop:sameSender?1:6}}>
                    <div style={{
                      maxWidth:'76%',padding:'9px 13px',borderRadius:18,fontSize:14.5,lineHeight:1.45,wordBreak:'break-word',
                      background: mine ? INDIGO : BUBBLE_IN,
                      borderBottomRightRadius: mine ? 5 : 18,
                      borderBottomLeftRadius: mine ? 18 : 5,
                      color: T1
                    }}>
                      {m.content}
                      <div style={{display:'flex',justifyContent:'flex-end',marginTop:3,gap:3}}>
                        <span style={{fontSize:10.5,opacity:0.6}}>{fmtTime(m.created_at)}</span>
                        {mine && <span style={{fontSize:11,color:SAGE,opacity:0.8}}>✓✓</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={msgEndRef}/>
            </div>

            {/* Composer */}
            <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px 14px',borderTop:`0.5px solid ${BORDER}`,flexShrink:0,background:'#0D0D12'}}>
              <div style={{flex:1,background:BG3,borderRadius:22,padding:'11px 16px',display:'flex',alignItems:'center'}}>
                <input
                  ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendMsg()}
                  placeholder="Message" style={{background:'none',border:'none',outline:'none',color:T1,fontSize:14.5,width:'100%',fontFamily:'inherit'}}
                />
              </div>
              <button className="send-btn" onClick={sendMsg} style={{width:42,height:42,borderRadius:'50%',background:input.trim()?INDIGO:BG3,border:'none',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'background 0.15s',flexShrink:0}}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 12L20 4L13 20L11 13L4 12Z" stroke={input.trim()?'#fff':T3} strokeWidth="1.8" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}