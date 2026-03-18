import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './supabase'

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

export default function App() {
  const [nickname, setNickname] = useState('')
  const [joined, setJoined] = useState(false)
  const [playlist, setPlaylist] = useState([])
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [currentSong, setCurrentSong] = useState(null)
  const [error, setError] = useState('')

  const playerRef = useRef(null)
  const playerDivRef = useRef(null)
  const chatEndRef = useRef(null)
  const isHostAction = useRef(false)
  const handleNextSongRef = useRef(null)

  // handlePlaySong 먼저 선언
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

  // handleNextSong 선언
  const handleNextSong = useCallback(async () => {
    setPlaylist(prev => {
      const idx = prev.findIndex(s => s.video_id === currentSong?.video_id)
      const next = prev[idx + 1]
      if (next) handlePlaySong(next)
      return prev
    })
  }, [currentSong, handlePlaySong])

  // ref 동기화
  useEffect(() => {
    handleNextSongRef.current = handleNextSong
  }, [handleNextSong])

  // YouTube 플레이어 초기화
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

  // Supabase 실시간 구독
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
    setJoined(true)
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

    await supabase.from('playlist').insert({
      video_id: videoId,
      title,
      added_by: nickname,
    })
    setUrlInput('')
  }

  const handleSendChat = async () => {
    if (!chatInput.trim()) return
    await supabase.from('messages').insert({
      nickname,
      content: chatInput,
    })
    setChatInput('')
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 w-full max-w-sm text-center">
          <div className="text-3xl mb-2">🎵</div>
          <h1 className="text-white text-2xl font-bold mb-1">Music Station</h1>
          <p className="text-zinc-400 text-sm mb-8">하아 원조빅파이</p>
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎵</span>
          <span className="font-semibold text-white">Music Station</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-400 rounded-full"></span>
          <span className="text-zinc-400 text-sm">{nickname}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 왼쪽: 영상 */}
        <div className="flex-1 flex flex-col p-4 gap-4">
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

        {/* 오른쪽 패널 */}
        <div className="w-80 border-l border-zinc-800 flex flex-col">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <span className="text-sm font-medium text-zinc-300">플레이리스트</span>
              <span className="ml-2 text-xs text-zinc-500">{playlist.length}곡</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {playlist.length === 0 && (
                <p className="text-zinc-600 text-sm text-center mt-8">아직 곡이 없어요</p>
              )}
              {playlist.map((song) => (
                <div
                  key={song.id}
                  onClick={() => handlePlaySong(song)}
                  className={`px-4 py-3 cursor-pointer hover:bg-zinc-800 transition-colors border-b border-zinc-900 ${
                    currentSong?.video_id === song.video_id ? 'bg-zinc-800 border-l-2 border-l-white' : ''
                  }`}
                >
                  <p className="text-sm text-white truncate">{song.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{song.added_by}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="h-72 border-t border-zinc-800 flex flex-col">
            <div className="px-4 py-2 border-b border-zinc-800">
              <span className="text-sm font-medium text-zinc-300">채팅</span>
            </div>
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
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                maxLength={200}
              />
              <button
                onClick={handleSendChat}
                className="bg-zinc-700 text-white px-3 py-2 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}