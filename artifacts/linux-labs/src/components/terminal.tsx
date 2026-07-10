import * as React from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export interface TerminalProps {
  labId: string
  terminalName: string
  className?: string
}

export function Terminal({ labId, terminalName, className }: TerminalProps) {
  const terminalRef = React.useRef<HTMLDivElement>(null)
  const xtermRef = React.useRef<XTerm | null>(null)
  const fitAddonRef = React.useRef<FitAddon | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)

  const [connected, setConnected] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const connect = React.useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
    }
    
    setError(null)
    setConnected(false)

    const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${import.meta.env.BASE_URL}api/ws/terminal?labId=${labId}&terminal=${terminalName}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Send initial resize if xterm exists
      if (xtermRef.current && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols: xtermRef.current.cols, rows: xtermRef.current.rows }))
      }
    }

    ws.binaryType = "arraybuffer"
    ws.onmessage = (event) => {
      // Binary framing: first byte = message type
      //   0x01 — raw terminal output (write directly to xterm)
      //   0x02 — control/status JSON (low frequency)
      if (event.data instanceof ArrayBuffer) {
        const buf = new Uint8Array(event.data)
        if (buf.length === 0) return
        if (buf[0] === 0x01) {
          // Fast path: write raw bytes directly — no JSON parse
          xtermRef.current?.write(buf.slice(1))
        } else if (buf[0] === 0x02) {
          try {
            const msg = JSON.parse(new TextDecoder().decode(buf.slice(1)))
            if (msg.type === "status" && msg.message) {
              xtermRef.current?.write(`\x1b[90m\r\n--- ${msg.message} ---\x1b[0m\r\n`)
            }
          } catch {
            // Ignore malformed control frames
          }
        }
      }
    }

    ws.onclose = () => {
      setConnected(false)
      xtermRef.current?.write(`\x1b[31m\r\n--- Disconnected ---\x1b[0m\r\n`)
    }

    ws.onerror = () => {
      setError("WebSocket connection error")
      setConnected(false)
    }
  }, [labId, terminalName])

  React.useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
      fontSize: 14,
      theme: {
        background: "#09090b", // Deep dark background regardless of theme
        foreground: "#f8fafc",
        cursor: "#00f0ff",
        black: "#1e1e1e",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#f59e0b",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#f8fafc",
      }
    })
    
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    
    term.open(terminalRef.current)
    fitAddon.fit()
    
    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Handle user input
    term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "input", data }))
      }
    })

    term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }))
      }
    })

    const handleWindowResize = () => {
      fitAddon.fit()
    }
    window.addEventListener("resize", handleWindowResize)

    connect()

    return () => {
      window.removeEventListener("resize", handleWindowResize)
      if (wsRef.current) {
        wsRef.current.close()
      }
      term.dispose()
    }
  }, [connect])

  return (
    <div className={cn("relative flex h-full w-full flex-col bg-[#09090b] rounded-md overflow-hidden border border-border", className)}>
      {/* Terminal header */}
      <div className="flex items-center justify-between px-4 py-2 bg-secondary border-b border-border">
        <div className="flex items-center space-x-2">
          <div className={cn("h-2 w-2 rounded-full", connected ? "bg-green-500" : "bg-destructive")} />
          <span className="text-xs font-mono text-muted-foreground">{terminalName}</span>
        </div>
        {!connected && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={connect}>
            <RefreshCw className="w-3 h-3 mr-1" />
            Reconnect
          </Button>
        )}
      </div>
      
      {/* Terminal container */}
      <div className="flex-1 p-2 overflow-hidden" ref={terminalRef} />
      
      {error && (
        <div className="absolute bottom-4 left-4 right-4 bg-destructive/90 text-destructive-foreground p-3 rounded-md shadow-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={connect} className="h-7 border-destructive-foreground/20 hover:bg-destructive-foreground/10 text-destructive-foreground">
            Retry
          </Button>
        </div>
      )}
    </div>
  )
}
