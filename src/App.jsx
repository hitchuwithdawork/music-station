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
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
  ]
  for (const p of patterns) {
    const m = url.match(p)
    if (m) return m[1]
  }
  return null
}

// ─── 플레이리스트 패널 (App 밖) ───
function PlaylistPanel({ playlist, currentSong, isHost, onPlay, onDelete, onMoveUp, onMoveDown }) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <div>
          <span className="text-sm font-medium text-zinc-300">플레이리스트</span>
          <span className="ml-2 text-xs text-zinc-500">{playlist.length}곡</span>
        </div>
        {isHost && <span className="text-xs text-yellow-400">👑 호스트</span>}
      </div>
      <div className="flex-1 overflow-y-auto">
        {playlist.length === 0 && (
          <p className="text-zinc-600 text-sm text-center mt-8">아직 곡이 없어요</p>
        )}
        {playlist.map((song, idx) => (
          <div
            key={song.id}
            className={`px-3 py-3 border-b border-zinc-900 ${
              currentSong?.video_id === song.video_id ? 'bg-zinc-800 border-l-2 border-l-white' : ''
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1 cursor-pointer min-w-0" onClick={() => onPlay(song)}>
                <p className="text-sm text-white truncate">{song.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{song.added_by}</p>
              </div>
              {isHost && (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => onMoveUp(idx)}
                    disabled={idx === 0}
                    className="text-zinc-400 hover:text-white disabled:opacity-20 px-1 text-xs"
                  >▲</button>
                  <button
                    onClick={() => onMoveDown(idx)}
                    disabled={idx === playlist.length - 1}
                    className="text-zinc-400 hover:text-white disabled:opacity-20 px-1 text-xs"
                  >▼</button>
                  <button
                    onClick={() => onDelete(song.id)}
                    className="text-red-500 hover:text-red-400 px-1 text-xs"
                  >✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── 채팅 패널 (App 밖) ───
function ChatPanel({ messages, chatInput, setChatInput, onSend, chatEndRef }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {messages.map((msg) => (
          <div key={msg.id}>
            <span className="text-xs font-medium text-zinc-300">{msg.nickname} </span>
            <span className="text-xs text-zinc-400">{msg.content}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="p-2 border-t border-zinc-800 flex gap-2">
        <input
          className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-500"
          placeholder="메시지..."
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          maxLength={200}
        />
        <button
          onClick={onSend}
          className="bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
        >
          전송
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
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [playlist, setPlaylist] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [currentSong, setCurrentSong] = useState(null)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('playlist')

  const playerRef = useRef(null)
  const playerDivRef = useRef(null)
  const chatEndRef = useRef(null)
  const isHostAction = useRef(false)
  const handleNextSongRef = useRef(null)

  const handlePlaySong = useCallback(async (song) => {
    isHostAction.current = true
    if (playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(song.video_id)
    }
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

  useEffect(() => {
    handleNextSongRef.current = handleNextSong
  }, [handleNextSong])

  useEffect(() => {
    if (!joined) return
    loadYouTubeAPI().then(() => {
      playerRef.current = new window.YT.Player(playerDivRef.current, {
        height: '100%',
        width: '100%',
        videoId: '',
        playerVars: { autoplay: 1, controls: 1 },
        events: {
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              handleNextSongRef.current?.()
            }
          }
        }
      })
    })
  }, [joined])

  useEffect(() => {
    if (!joined) return

    supabase.from('playlist').select('*').order('created_at').then(({ data }) => {
      if (data) setPlaylist(data)
    })

    const playlistSub = supabase.channel('playlist-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'playlist' }, () => {
        supabase.from('playlist').select('*').order('created_at').then(({ data }) => {
          if (data) setPlaylist(data)
        })
      })
      .subscribe()

    supabase.from('messages').select('*').order('created_at').limit(50).then(({ data }) => {
      if (data) setMessages(data)
    })

    const chatSub = supabase.channel('chat-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    supabase.from('room_state').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setCurrentSong(data)
    })

    const roomSub = supabase.channel('room-state-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_state' }, (payload) => {
        const newState = payload.new
        setCurrentSong(newState)
        if (!isHostAction.current && playerRef.current?.loadVideoById) {
          if (newState.video_id) {
            playerRef.current.loadVideoById(newState.video_id)
          }
        }
        isHostAction.current = false
      })
      .subscribe()

    return () => {
      supabase.removeChannel(playlistSub)
      supabase.removeChannel(chatSub)
      supabase.removeChannel(roomSub)
    }
  }, [joined])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleJoin = () => {
    if (!nickname.trim()) { setError('닉네임을 입력해주세요'); return }
    if (nickname === 'super.admin') {
      setShowPasswordModal(true)
      return
    }
    setJoined(true)
  }

  const handlePasswordSubmit = () => {
    if (passwordInput === 'dmddo') {
      setIsHost(true)
      setShowPasswordModal(false)
      setPasswordError('')
      setJoined(true)
    } else {
      setPasswordError('비밀번호가 틀렸어요')
    }
  }

  const handleAddSong = async () => {
    const videoId = extractVideoId(urlInput)
    if (!videoId) { setError('올바른 YouTube URL을 입력해주세요'); return }
    setError('')
    let title = '제목 불러오는 중...'
    try {
      const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
      const json = await res.json()
      title = json.title || 'Unknown'
    } catch (e) {
      console.error('제목 조회 실패:', e)
    }
    await supabase.from('playlist').insert({ video_id: videoId, title, added_by: nickname })
    setUrlInput('')
  }

  const handleDeleteSong = async (id) => {
    await supabase.from('playlist').delete().eq('id', id)
  }

  const handleMoveUp = async (idx) => {
    if (idx === 0) return
    const a = playlist[idx]
    const b = playlist[idx - 1]
    const tempTime = a.created_at
    await supabase.from('playlist').update({ created_at: b.created_at }).eq('id', a.id)
    await supabase.from('playlist').update({ created_at: tempTime }).eq('id', b.id)
  }

  const handleMoveDown = async (idx) => {
    if (idx === playlist.length - 1) return
    const a = playlist[idx]
    const b = playlist[idx + 1]
    const tempTime = a.created_at
    await supabase.from('playlist').update({ created_at: b.created_at }).eq('id', a.id)
    await supabase.from('playlist').update({ created_at: tempTime }).eq('id', b.id)
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    await supabase.from('messages').insert({ nickname, content: chatInput })
    setChatInput('')
  }

  // 비밀번호 모달
  if (showPasswordModal) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="text-2xl mb-2">👑</div>
          <h2 className="text-white text-xl font-bold mb-1">호스트 인증</h2>
          <p className="text-zinc-400 text-sm mb-6">비밀번호를 입력하세요</p>
          {passwordError && <p className="text-red-400 text-sm mb-3">{passwordError}</p>}
          <input
            className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 mb-4 outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-500"
            type="password"
            placeholder="비밀번호..."
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
            autoFocus
          />
          <button
            onClick={handlePasswordSubmit}
            className="w-full bg-yellow-400 text-zinc-900 font-semibold rounded-lg py-3 hover:bg-yellow-300 transition-colors mb-3"
          >
            입장
          </button>
          <button
            onClick={() => setShowPasswordModal(false)}
            className="text-zinc-500 text-sm hover:text-zinc-400"
          >
            취소
          </button>
        </div>
      </div>
    )
  }

  // 입장 화면
  if (!joined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-sm text-center">
          <img src={bonkImg} alt="bonk" className="w-full rounded-xl mb-6 object-cover" />
          <h1 className="text-white text-2xl font-bold mb-1">세진아똥쌌니</h1>
          <p className="text-zinc-400 text-sm mb-6">함께 듣는 실시간 뮤직 스테이션</p>
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <input
            className="w-full bg-zinc-800 text-white rounded-lg px-4 py-3 mb-4 outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-500"
            placeholder="닉네임 입력..."
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            maxLength={20}
          />
          <button
            onClick={handleJoin}
            className="w-full bg-white text-zinc-900 font-semibold rounded-lg py-3 hover:bg-zinc-200 transition-colors"
          >
            입장하기
          </button>
        </div>
      </div>
    )
  }

  const panelProps = {
    playlist, currentSong, isHost,
    onPlay: handlePlaySong,
    onDelete: handleDeleteSong,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
  }

  const chatProps = {
    messages, chatInput, setChatInput,
    onSend: handleSendChat,
    chatEndRef,
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* 헤더 */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">🎵</span>
          <span className="font-semibold text-white text-sm">세진아똥쌌니</span>
        </div>
        <div className="flex items-center gap-2">
          {isHost && <span className="text-yellow-400 text-xs">👑 호스트</span>}
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          <span className="text-zinc-400 text-sm truncate max-w-24">{nickname}</span>
        </div>
      </header>

      {/* 데스크탑 */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          <div className="bg-zinc-900 rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <div ref={playerDivRef} className="w-full h-full" />
          </div>
          {currentSong?.video_id && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <p className="text-zinc-400 text-xs mb-1">NOW PLAYING</p>
              <p className="text-white font-medium truncate">{currentSong.title}</p>
              <p className="text-zinc-500 text-sm">추가: {currentSong.added_by}</p>
            </div>
          )}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-zinc-400 text-xs mb-3">곡 추가하기</p>
            {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <input
                className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-zinc-700 focus:border-zinc-500 placeholder-zinc-500"
                placeholder="YouTube URL 붙여넣기..."
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSong()}
              />
              <button
                onClick={handleAddSong}
                className="bg-white text-zinc-900 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors whitespace-nowrap"
              >
                추가
              </button>
            </div>
          </div>
        </div>
        <div className="w-80 border-l border-zinc-800 flex flex-col">
          <PlaylistPanel {...panelProps} />
          <div className="h-72 border-t border-zinc-800 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-800 shrink-0">
              <span className="text-sm font-medium text-zinc-300">채팅</span>
            </div>
            <ChatPanel {...chatProps} />
          </div>
        </div>
      </div>

      {/* 모바일 */}
      <div className="flex md:hidden flex-col flex-1 overflow-hidden">
        <div className="bg-zinc-900 shrink-0" style={{ aspectRatio: '16/9' }}>
          <div ref={playerDivRef} className="w-full h-full" />
        </div>
        {currentSong?.video_id && (
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
            <p className="text-zinc-400 text-xs">NOW PLAYING</p>
            <p className="text-white text-sm font-medium truncate">{currentSong.title}</p>
          </div>
        )}
        <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0">
          {error && <p className="text-red-400 text-xs mb-1">{error}</p>}
          <div className="flex gap-2">
            <input
              className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm outline-none border border-zinc-700 placeholder-zinc-500"
              placeholder="YouTube URL..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddSong()}
            />
            <button
              onClick={handleAddSong}
              className="bg-white text-zinc-900 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
            >
              추가
            </button>
          </div>
        </div>
        <div className="flex border-b border-zinc-800 shrink-0">
          <button
            onClick={() => setActiveTab('playlist')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'playlist' ? 'text-white border-b-2 border-white' : 'text-zinc-500'
            }`}
          >
            플레이리스트
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              activeTab === 'chat' ? 'text-white border-b-2 border-white' : 'text-zinc-500'
            }`}
          >
            채팅
          </button>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'playlist'
            ? <PlaylistPanel {...panelProps} />
            : <ChatPanel {...chatProps} />
          }
        </div>
      </div>
    </div>
  )
}