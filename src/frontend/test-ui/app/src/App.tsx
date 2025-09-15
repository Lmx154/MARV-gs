import { useEffect, useMemo, useRef, useState } from 'react'

type Device = {
  port: string
  description?: string
  hwid?: string
}

function useDevices(apiBase = '') {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDevices = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/serial/devices`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const body = await res.json()
      setDevices(Array.isArray(body?.devices) ? body.devices : [])
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch devices')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDevices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { devices, loading, error, refresh: fetchDevices }
}

function useWs(url: string) {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [messages, setMessages] = useState<string[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(url)
    wsRef.current = ws
    ws.onopen = () => setStatus('connected')
    ws.onclose = () => setStatus('disconnected')
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'status') {
          setStatus(msg.state)
        } else if (msg.type === 'data') {
          setMessages((prev: string[]) => [...prev, msg.line])
        } else {
          setMessages((prev: string[]) => [...prev, ev.data])
        }
      } catch {
  setMessages((prev: string[]) => [...prev, ev.data])
      }
    }
    return () => ws.close()
  }, [url])

  return { status, messages }
}

function classNames(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ')
}

export default function App() {
  const [port, setPort] = useState('COM3')
  const [baud, setBaud] = useState(115200)
  const [cmd, setCmd] = useState('')

  const apiBase = '' // same origin
  const wsUrl = useMemo(() => {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    return `${proto}${location.host}/ws`
  }, [])

  const { status, messages } = useWs(wsUrl)
  const { devices, loading: loadingDevs, error: devErr, refresh } = useDevices(apiBase)

  async function openPort() {
    const res = await fetch(`${apiBase}/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ port, baud })
    })
    const body = await res.json()
    console.log('OPEN ->', body)
  }
  async function closePort() {
    const res = await fetch(`${apiBase}/close`, { method: 'POST' })
    const body = await res.json()
    console.log('CLOSE ->', body)
  }
  async function writeCmd() {
    const res = await fetch(`${apiBase}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd })
    })
    const body = await res.json()
    console.log('WRITE ->', body)
    setCmd('')
  }

  return (
    <div className="container">
      <header>
        <h1>MARV-gs Test UI</h1>
        <div className={classNames('pill', status === 'connected' && 'ok', status === 'disconnected' && 'bad')}>
          Status: {status}
        </div>
      </header>

      <section className="card">
        <div className="row">
          <input
            list="device-list"
            value={port}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPort(e.target.value)}
            placeholder="COM3 or /dev/ttyUSB0"
            title="Type a port or choose from detected devices"
          />
          <datalist id="device-list">
            {devices.map((d) => (
              <option key={d.port} value={d.port} label={d.description || d.hwid || d.port} />
            ))}
          </datalist>
          <button onClick={refresh} title="Refresh device list" disabled={loadingDevs}>↻ Refresh</button>
          <input
            type="number"
            value={baud}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBaud(Number(e.target.value))}
          />
          <button onClick={openPort}>Open</button>
          <button onClick={closePort}>Close</button>
        </div>
        {devErr && <div className="muted">Devices: {devErr}</div>}
        <div className="row">
          <input
            value={cmd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCmd(e.target.value)}
            placeholder="Command (newline auto-appended)"
          />
          <button onClick={writeCmd}>Write</button>
        </div>
      </section>

      <div className="grid">
        <section className="card">
          <h3>Live Data</h3>
          <pre className="scroller">
            {messages.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </pre>
        </section>
        <section className="card">
          <h3>Hints</h3>
          <ul className="muted">
            <li>Same-origin API: dev server proxies to backend on 8000</li>
            <li>WebSocket: {wsUrl}</li>
            <li>Open/Close/Write available via buttons</li>
          </ul>
        </section>
      </div>

      <footer className="muted">Minimal React + TypeScript test harness</footer>
    </div>
  )
}
