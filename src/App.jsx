import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import bonkImg from './assets/bonk.png'

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) { resolve(); return; }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = resolve
  })
}

function extractVideoId(url) {
  const patterns = [/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

function getThumbUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

const EMOJIS = ['🔥', '❤️', '😂', '🎵', '💜', '🤩', '👏', '⚡']

// ─── 이모지 파티클 ───
function EmojiParticle({ emoji, id, onDone }) {
  const [left] = useState(() => 10 + Math.random() * 80)
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 2800)
    return () => clearTimeout(t)
  }, [id, onDone])
  return (
    <div
      className="fixed pointer-events-none z-50 text-2xl select-none"
      style={{
        left: `${left.current}%`,
        bottom: '80px',
        animation: 'floatUp 2.8s ease-out forwards',
      }}
    >
      {emoji}
    </div>
  )
}

// ─── 플레이리스트 패널 ───
function PlaylistPanel({ playlist, currentSong, isHost, djMode, onPlay, onDelete, onMoveUp, onMoveDown, onClearAll }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
        <div>
          <span className="text-sm font-semibold text-white/80 tracking-widest uppercase">Queue</span>
          <span className="ml-2 text-xs text-white/30">{playlist.length} tracks</span>
        </div>
        <div className="flex items-center gap-2">
          {djMode && <span className="text-xs text-cyan-300 bg-cyan-300/10 border border-cyan-300/20 px-2 py-0.5 rounded-full">🎛️ DJ</span>}
          {isHost && (
            <button onClick={onClearAll}
              className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-1">
              🗑️
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {playlist.length === 0 && (
          <p className="text-white/20 text-sm text-center mt-10">플레이리스트가 비어있어요</p>
        )}
        {playlist.map((song, idx) => (
          <div key={song.id}
            className={`group px-3 py-2.5 border-b border-white/5 flex items-center gap-3 transition-all duration-200
              ${currentSong?.video_id === song.video_id ? 'bg-white/10 border-l-2 border-l-purple-400' : 'hover:bg-white/5'}`}>
            <div className="relative shrink-0 w-12 h-9 rounded overflow-hidden bg-white/5">
              <img src={getThumbUrl(song.video_id)} alt=""
                className="w-full h-full object-cover"
                onError={e => { e.target.style.display = 'none' }} />
              {currentSong?.video_id === song.video_id && (
                <div className="absolute inset-0 bg-purple-500/40 flex items-center justify-center">
                  <div className="flex gap-0.5 items-end h-4">
                    {[60, 100, 40].map((h, i) => (
                      <div key={i} className="w-0.5 bg-purple-300 rounded-full animate-bounce"
                        style={{ height: `${h}%`, animationDelay: `${i * 150}ms` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onPlay(song)}>
              <p className={`text-sm truncate ${currentSong?.video_id === song.video_id ? 'text-purple-300 font-medium' : 'text-white/80'}`}>
                {song.title}
              </p>
              <p className="text-xs text-white/30 mt-0.5 truncate">{song.added_by}</p>
            </div>
            {isHost && (
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onMoveUp(idx)} disabled={idx === 0}
                  className="text-white/40 hover:text-white disabled:opacity-10 px-1 text-xs py-1">▲</button>
                <button onClick={() => onMoveDown(idx)} disabled={idx === playlist.length - 1}
                  className="text-white/40 hover:text-white disabled:opacity-10 px-1 text-xs py-1">▼</button>
                <button onClick={() => onDelete(song.id)}
                  className="text-red-400/60 hover:text-red-400 px-1 text-xs py-1">✕</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 히스토리 패널 ───
function HistoryPanel({ history }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <span className="text-sm font-semibold text-white/80 tracking-widest uppercase">History</span>
        <span className="ml-2 text-xs text-white/30">{history.length} played</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 && (
          <p className="text-white/20 text-sm text-center mt-10">재생 기록이 없어요</p>
        )}
        {[...history].reverse().map((song) => (
          <div key={song.id} className="px-3 py-2.5 border-b border-white/5 flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity">
            <img src={getThumbUrl(song.video_id)} alt=""
              className="w-12 h-9 rounded object-cover shrink-0 bg-white/5"
              onError={e => { e.target.style.display = 'none' }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white/80 truncate">{song.title}</p>
              <p className="text-xs text-white/30 mt-0.5">{song.added_by} · {new Date(song.played_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 채팅 패널 ───
function ChatPanel({ messages, chatInput, setChatInput, onSend, chatEndRef }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-white/20 text-xs text-center mt-4">아직 채팅이 없어요</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 items-start ${msg.is_system ? 'opacity-50' : ''}`}>
            {msg.is_system
              ? <span className="text-xs text-white/40 italic w-full">{msg.content}</span>
              : <>
                  <span className="text-xs font-semibold text-cyan-400 shrink-0">{msg.nickname}</span>
                  <span className="text-xs text-white/60 leading-relaxed">{msg.content}</span>
                </>
            }
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="p-2 border-t border-white/10 flex gap-2">
        <input
          className="flex-1 bg-white/5 text-white rounded-xl px-3 py-2 text-sm outline-none border border-white/10 focus:border-purple-500/60 placeholder-white/20 transition-colors"
          placeholder="메시지 입력..."
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          maxLength={200}
        />
        <button onClick={onSend}
          className="bg-purple-600/60 hover:bg-purple-500/80 text-white px-3 py-2 rounded-xl text-sm transition-colors">
          →
        </button>
      </div>
    </div>
  )
}

// ─── 메인 App ───
export default function App() {
  const [nickname, setNickname] = useState('')
  const [joined, setJoined] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [djMode, setDjMode] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showNicknameModal, setShowNicknameModal] = useState(false)
  const [newNickname, setNewNickname] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [playlist, setPlaylist] = useState([])
  const [history, setHistory] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [currentSong, setCurrentSong] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('playlist')
  const [rightTab, setRightTab] = useState('playlist')
  const [particles, setParticles] = useState([])
  const [onlineCount, setOnlineCount] = useState(1)

  const playerRef = useRef(null)
  const playerDivRef = useRef(null)
  const chatEndRef = useRef(null)
  const isHostAction = useRef(false)
  const handleNextSongRef = useRef(null)
  const nicknameRef = useRef(nickname)

  useEffect(() => { nicknameRef.current = nickname }, [nickname])

  const sendSystemMessage = useCallback(async (content) => {
    await supabase.from('messages').insert({ nickname: 'system', content, is_system: true })
  }, [])

  const handlePlaySong = useCallback(async (song) => {
    isHostAction.current = true
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(song.video_id)
    }
    // 히스토리에 추가
    await supabase.from('history').insert({
      video_id: song.video_id,
      title: song.title,
      added_by: song.added_by,
    })
    await supabase.from('room_state').update({
      video_id: song.video_id,
      title: song.title,
      added_by: song.added_by,
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
  }, [])

  const handleNextSong = useCallback(() => {
    setPlaylist(prev => {
      const idx = prev.findIndex(s => s.video_id === currentSong?.video_id)
      const next = prev[idx + 1]
      if (next) handlePlaySong(next)
      return prev
    })
  }, [currentSong, handlePlaySong])

  useEffect(() => { handleNextSongRef.current = handleNextSong }, [handleNextSong])

  useEffect(() => {
    if (!joined) return
    loadYouTubeAPI().then(() => {
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: '100%', width: '100%', videoId: '',
        playerVars: { autoplay: 1, controls: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) handleNextSongRef.current?.()
          }
        }
      })
    })
  }, [joined])

  useEffect(() => {
    if (!joined) return

    // Presence (접속자 수)
    const presenceChannel = supabase.channel('online-users')
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState()
        setOnlineCount(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ nickname: nicknameRef.current, online_at: new Date().toISOString() })
        }
      })

    // 입장 알림
    sendSystemMessage(`👋 ${nicknameRef.current} 입장`)

    // 플레이리스트
    supabase.from('playlist').select('*').order('sort_order').order('created_at').then(({ data }) => {
      if (data) setPlaylist(data)
    })
    const playlistSub = supabase.channel('playlist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist' }, () => {
        supabase.from('playlist').select('*').order('sort_order').order('created_at').then(({ data }) => {
          if (data) setPlaylist(data)
        })
      }).subscribe()

    // 히스토리
    supabase.from('history').select('*').order('played_at').limit(30).then(({ data }) => {
      if (data) setHistory(data)
    })
    const historySub = supabase.channel('history-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, (payload) => {
        setHistory(prev => [...prev, payload.new])
      }).subscribe()

    // 채팅
    supabase.from('messages').select('*').order('created_at').limit(50).then(({ data }) => {
      if (data) setMessages(data)
    })
    const chatSub = supabase.channel('chat-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      }).subscribe()

    // room_state
    supabase.from('room_state').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) {
        setCurrentSong(data)
        setDjMode(data.dj_mode ?? false)
      }
    })
    const roomSub = supabase.channel('room-state-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_state' }, (payload) => {
        const newState = payload.new
        setCurrentSong(newState)
        setDjMode(newState.dj_mode ?? false)
        if (!isHostAction.current && playerRef.current?.loadVideoById && newState.video_id) {
          playerRef.current.loadVideoById(newState.video_id)
        }
        isHostAction.current = false
      }).subscribe()

    // 퇴장 알림
    const handleUnload = () => {
      supabase.from('messages').insert({ nickname: 'system', content: `🚪 ${nicknameRef.current} 퇴장`, is_system: true })
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      supabase.removeChannel(presenceChannel)
      supabase.removeChannel(playlistSub)
      supabase.removeChannel(historySub)
      supabase.removeChannel(chatSub)
      supabase.removeChannel(roomSub)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [joined, sendSystemMessage])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleJoin = () => {
    if (!nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    if (nickname.trim() === 'super.admin') { setShowPasswordModal(true); return }
    setJoined(true)
  }

  const handlePasswordSubmit = () => {
    if (passwordInput === 'dmddo') {
      setIsHost(true); setShowPasswordModal(false); setPasswordError(''); setJoined(true)
    } else {
      setPasswordError('비밀번호가 틀렸어요')
    }
  }

  const handleNicknameChange = () => {
    if (!newNickname.trim()) { setNicknameError('닉네임을 입력해주세요'); return }
    setNickname(newNickname.trim())
    setShowNicknameModal(false); setNewNickname(''); setNicknameError('')
  }

  const handleAddSong = async () => {
    if (djMode && !isHost) { setError('DJ 모드: 호스트만 곡을 추가할 수 있어요'); return }
    const videoId = extractVideoId(urlInput)
    if (!videoId) { setError('올바른 YouTube URL을 입력해주세요'); return }
    setError('')
    const maxOrder = playlist.length > 0 ? Math.max(...playlist.map(s => s.sort_order ?? 0)) + 1 : 0
    let title = 'Loading...'
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      const json = await res.json()
      title = json.title || 'Unknown'
    } catch (e) { console.error('제목 조회 실패:', e) }
    await supabase.from('playlist').insert({ video_id: videoId, title, added_by: nickname, sort_order: maxOrder })
    await sendSystemMessage(`🎵 ${nickname}님이 "${title}" 추가`)
    setUrlInput('')
  }

  const handleDeleteSong = async (id) => {
    await supabase.from('playlist').delete().eq('id', id)
  }

  const handleClearAll = async () => {
    if (!window.confirm('플레이리스트를 전부 비울까요?')) return
    await supabase.from('playlist').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const a = playlist[idx], b = playlist[idx - 1]
    await supabase.from('playlist').update({ sort_order: b.sort_order ?? idx - 1 }).eq('id', a.id)
    await supabase.from('playlist').update({ sort_order: a.sort_order ?? idx }).eq('id', b.id)
  }

  const handleMoveDown = async (idx) => {
    if (idx === playlist.length - 1) return
    const a = playlist[idx], b = playlist[idx + 1]
    await supabase.from('playlist').update({ sort_order: b.sort_order ?? idx + 1 }).eq('id', a.id)
    await supabase.from('playlist').update({ sort_order: a.sort_order ?? idx }).eq('id', b.id)
  }

  const handleToggleDjMode = async () => {
    const next = !djMode
    await supabase.from('room_state').update({ dj_mode: next }).eq('id', 1)
    await sendSystemMessage(next ? '🎛️ DJ 모드 ON — 호스트만 곡 추가 가능' : '🎛️ DJ 모드 OFF')
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    await supabase.from('messages').insert({ nickname, content: chatInput, is_system: false })
    setChatInput('')
  }

const handleEmoji = (emoji) => {
  const id = crypto.randomUUID()
  setParticles(prev => [...prev, { id, emoji }])
}

  const removeParticle = useCallback((id) => {
    setParticles(prev => prev.filter(p => p.id !== id))
  }, [])

  const thumbUrl = currentSong?.video_id ? getThumbUrl(currentSong.video_id) : null

  const panelProps = { playlist, currentSong, isHost, djMode, onPlay: handlePlaySong, onDelete: handleDeleteSong, onMoveUp: handleMoveUp, onMoveDown: handleMoveDown, onClearAll: handleClearAll }
  const chatProps = { messages, chatInput, setChatInput, onSend: handleSendChat, chatEndRef }

  // ── 비밀번호 모달 ──
  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/5 pointer-events-none" />
          <div className="text-3xl mb-3">👑</div>
          <h2 className="text-white text-xl font-bold mb-1 tracking-tight">Host Access</h2>
          <p className="text-white/40 text-sm mb-6">비밀번호를 입력하세요</p>
          {passwordError && <p className="text-red-400 text-sm mb-3">{passwordError}</p>}
          <input
            className="w-full bg-white/5 text-white rounded-xl px-4 py-3 mb-4 outline-none border border-white/10 focus:border-purple-500 placeholder-white/20 transition-colors"
            type="password" placeholder="••••••••"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            autoFocus
          />
          <button onClick={handlePasswordSubmit}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold rounded-xl py-3 hover:opacity-90 transition-opacity mb-3">
            입장
          </button>
          <button onClick={() => setShowPasswordModal(false)} className="text-white/30 text-sm hover:text-white/60">취소</button>
        </div>
      </div>
    )
  }

  // ── 입장 화면 ──
  if (!joined) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-600/15 rounded-full blur-3xl" />
        </div>
        <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center shadow-2xl">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/5 pointer-events-none" />
          <img src={bonkImg} alt="bonk" className="w-full rounded-xl mb-6 object-cover" />
          <h1 className="text-white text-2xl font-black mb-1 tracking-tight">세진아똥쌌니</h1>
          <p className="text-white/30 text-sm mb-6 tracking-wide">REALTIME MUSIC STATION</p>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <input
            className="w-full bg-white/5 text-white rounded-xl px-4 py-3 mb-4 outline-none border border-white/10 focus:border-purple-500 placeholder-white/20 transition-colors"
            placeholder="닉네임 입력..."
            value={nickname}
            onChange={e => setNickname(e.target.value.trim())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={20}
          />
          <button onClick={handleJoin}
            className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold rounded-xl py-3 hover:opacity-90 transition-opacity">
            입장하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col overflow-hidden">
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60vh) scale(1.4); opacity: 0; }
        }
      `}</style>

      {/* 이모지 파티클 */}
      {particles.map(p => (
        <EmojiParticle key={p.id} id={p.id} emoji={p.emoji} onDone={removeParticle} />
      ))}

      {/* 동적 배경 */}
      {thumbUrl && (
        <div className="fixed inset-0 pointer-events-none z-0 transition-all duration-1000">
          <img src={thumbUrl} alt="" className="w-full h-full object-cover opacity-10 blur-3xl scale-110" />
          <div className="absolute inset-0 bg-[#0a0a0f]/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/60" />
        </div>
      )}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl" />
      </div>

      {/* 닉네임 변경 모달 */}
      {showNicknameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 w-full max-w-sm text-center">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/10 to-cyan-500/5 pointer-events-none" />
            <h2 className="text-white text-lg font-bold mb-1">닉네임 변경</h2>
            <p className="text-white/40 text-sm mb-6">새 닉네임을 입력하세요</p>
            {nicknameError && <p className="text-red-400 text-sm mb-3">{nicknameError}</p>}
            <input
              className="w-full bg-white/5 text-white rounded-xl px-4 py-3 mb-4 outline-none border border-white/10 focus:border-purple-500 placeholder-white/20 transition-colors"
              placeholder="새 닉네임..."
              value={newNickname}
              onChange={e => setNewNickname(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNicknameChange()}
              autoFocus maxLength={20}
            />
            <button onClick={handleNicknameChange}
              className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 text-white font-semibold rounded-xl py-3 hover:opacity-90 transition-opacity mb-3">
              변경
            </button>
            <button onClick={() => { setShowNicknameModal(false); setNicknameError('') }}
              className="text-white/30 text-sm hover:text-white/60 transition-colors">취소</button>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <header className="relative z-10 border-b border-white/10 px-4 py-3 flex items-center justify-between shrink-0 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-sm">🎵</div>
          <span className="font-black text-white tracking-tight">세진아똥쌌니</span>
        </div>
        <div className="flex items-center gap-3">
          {/* 접속자 수 */}
          <div className="flex items-center gap-1.5 text-xs text-white/40 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            {onlineCount}명
          </div>
          {/* DJ 모드 토글 (호스트 전용) */}
          {isHost && (
            <button onClick={handleToggleDjMode}
              className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                djMode
                  ? 'text-cyan-300 bg-cyan-300/10 border-cyan-300/30'
                  : 'text-white/30 bg-white/5 border-white/10 hover:text-white/60'
              }`}>
              🎛️ DJ
            </button>
          )}
          {isHost && (
            <span className="text-xs text-yellow-300 bg-yellow-300/10 border border-yellow-300/20 px-2 py-0.5 rounded-full">
              👑 HOST
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => isHost && setShowNicknameModal(true)}
              className={`text-sm text-white/60 truncate max-w-28 ${isHost ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}
            >
              {nickname}
            </button>
          </div>
        </div>
      </header>

      {/* 이모지 바 */}
      <div className="relative z-10 flex justify-center gap-2 py-2 border-b border-white/5">
        {EMOJIS.map(e => (
          <button key={e} onClick={() => handleEmoji(e)}
            className="text-xl hover:scale-125 transition-transform active:scale-95">
            {e}
          </button>
        ))}
      </div>

      {/* 데스크탑 */}
      <div className="hidden md:flex flex-1 overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
          <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10" style={{ aspectRatio: '16/9' }}>
            <div ref={playerDivRef} className="w-full h-full" />
          </div>

          {currentSong?.video_id && (
            <div className="relative bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex gap-4 items-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
              <img src={getThumbUrl(currentSong.video_id)} alt=""
                className="w-16 h-12 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
                onError={e => { e.target.style.display = 'none' }} />
              <div className="flex-1 min-w-0">
                <p className="text-white/40 text-xs tracking-widest uppercase mb-1">Now Playing</p>
                <p className="text-white font-semibold truncate">{currentSong.title}</p>
                <p className="text-white/30 text-xs mt-0.5">added by {currentSong.added_by}</p>
              </div>
              <div className="flex gap-0.5 items-end h-6 shrink-0">
                {[60, 100, 40, 80, 60].map((h, i) => (
                  <div key={i} className="w-1 bg-purple-400 rounded-full animate-bounce"
                    style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4">
            <p className="text-white/40 text-xs tracking-widest uppercase mb-3">
              {djMode && !isHost ? '🎛️ DJ 모드 — 호스트만 추가 가능' : 'Add Track'}
            </p>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-white/5 text-white rounded-xl px-4 py-2.5 text-sm outline-none border border-white/10 focus:border-purple-500/60 placeholder-white/20 transition-colors disabled:opacity-40"
                placeholder="YouTube URL 붙여넣기..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSong()}
                disabled={djMode && !isHost}
              />
              <button onClick={handleAddSong}
                disabled={djMode && !isHost}
                className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap disabled:opacity-30">
                + 추가
              </button>
            </div>
          </div>
        </div>

        {/* 오른쪽 패널 */}
        <div className="w-80 border-l border-white/10 flex flex-col bg-white/[0.02] backdrop-blur-sm">
          {/* 탭 */}
          <div className="flex border-b border-white/10 shrink-0">
            {['playlist', 'history'].map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)}
                className={`flex-1 py-2.5 text-xs font-semibold tracking-widest uppercase transition-all ${
                  rightTab === tab ? 'text-white border-b-2 border-purple-400' : 'text-white/30 hover:text-white/60'
                }`}>
                {tab === 'playlist' ? 'Queue' : 'History'}
              </button>
            ))}
          </div>
          {rightTab === 'playlist'
            ? <PlaylistPanel {...panelProps} />
            : <HistoryPanel history={history} />
          }
          <div className="h-72 border-t border-white/10 flex flex-col">
            <div className="px-4 py-2.5 border-b border-white/10 shrink-0">
              <span className="text-xs font-semibold text-white/50 tracking-widest uppercase">Live Chat</span>
            </div>
            <ChatPanel {...chatProps} />
          </div>
        </div>
      </div>

      {/* 모바일 */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden relative z-10">
        <div className="shrink-0 rounded-b-2xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <div ref={playerDivRef} className="w-full h-full" />
        </div>

        {currentSong?.video_id && (
          <div className="px-4 py-2.5 bg-white/5 backdrop-blur-md border-b border-white/10 shrink-0 flex items-center gap-3">
            <img src={getThumbUrl(currentSong.video_id)} alt=""
              className="w-10 h-7 rounded object-cover shrink-0"
              onError={e => { e.target.style.display = 'none' }} />
            <div className="flex-1 min-w-0">
              <p className="text-white/40 text-xs uppercase tracking-widest">Now Playing</p>
              <p className="text-white text-sm font-medium truncate">{currentSong.title}</p>
            </div>
            <div className="flex gap-0.5 items-end h-4 shrink-0">
              {[60, 100, 40].map((h, i) => (
                <div key={i} className="w-0.5 bg-purple-400 rounded-full animate-bounce"
                  style={{ height: `${h}%`, animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        <div className="px-3 py-2 bg-white/5 border-b border-white/10 shrink-0">
          {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-white/5 text-white rounded-xl px-3 py-2 text-sm outline-none border border-white/10 placeholder-white/20 disabled:opacity-40"
              placeholder={djMode && !isHost ? 'DJ 모드 중...' : 'YouTube URL...'}
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSong()}
              disabled={djMode && !isHost}
            />
            <button onClick={handleAddSong} disabled={djMode && !isHost}
              className="bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-3 py-2 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-30">
              +
            </button>
          </div>
        </div>

        <div className="flex border-b border-white/10 shrink-0 bg-white/[0.02]">
          {['playlist', 'history', 'chat'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-semibold tracking-widest uppercase transition-all ${
                activeTab === tab ? 'text-white border-b-2 border-purple-400' : 'text-white/30'
              }`}>
              {tab === 'playlist' ? 'Queue' : tab === 'history' ? 'History' : 'Chat'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'playlist' && <PlaylistPanel {...panelProps} />}
          {activeTab === 'history' && <HistoryPanel history={history} />}
          {activeTab === 'chat' && <ChatPanel {...chatProps} />}
        </div>
      </div>
    </div>
  )
}