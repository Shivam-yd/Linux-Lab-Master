import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useParams, useLocation, Link } from "wouter"
import { 
  useGetLab, 
  useGetLabSession, 
  useStartLabSession, 
  useStopLabSession, 
  useResetLabSession, 
  useVerifyLab,
  getGetLabQueryKey,
  getGetLabSessionQueryKey
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import ReactMarkdown from "react-markdown"
import { Terminal as TerminalComponent } from "@/components/terminal"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Terminal, Play, Square, RotateCcw, ArrowLeft, 
  CheckCircle2, XCircle, AlertCircle, RefreshCw, Activity,
  Lightbulb, ChevronDown, ChevronRight, Eye
} from "lucide-react"

export default function Workspace() {
  const params = useParams()
  const labId = params.labId || ""
  const queryClient = useQueryClient()
  const [, setLocation] = useLocation()
  
  // Data hooks
  const { data: lab, isLoading: labLoading, error: labError } = useGetLab(labId, {
    query: { enabled: !!labId, queryKey: getGetLabQueryKey(labId) }
  })
  
  const { data: session, isLoading: sessionLoading } = useGetLabSession(labId, {
    query: { 
      enabled: !!labId, 
      queryKey: getGetLabSessionQueryKey(labId),
      refetchInterval: (query) => {
        const status = query.state.data?.status
        return (status === 'starting' || status === 'stopped') ? 2000 : false
      }
    }
  })

  // Mutations
  const startSession = useStartLabSession({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLabSessionQueryKey(labId), data)
      }
    }
  })
  
  const stopSession = useStopLabSession({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetLabSessionQueryKey(labId), (old: any) => 
          old ? { ...old, status: 'stopped' } : null
        )
        queryClient.invalidateQueries({ queryKey: getGetLabSessionQueryKey(labId) })
      }
    }
  })
  
  const resetSession = useResetLabSession({
    mutation: {
      onSuccess: (data) => {
        queryClient.setQueryData(getGetLabSessionQueryKey(labId), data)
        setVerifyResult(null)
      }
    }
  })

  const verifyLab = useVerifyLab()
  const [verifyResult, setVerifyResult] = useState<any>(null)

  // Hints state — tracks how many hints have been revealed
  const [hintsRevealed, setHintsRevealed] = useState(0)
  const [hintsOpen, setHintsOpen] = useState(false)

  // Steps/objectives state — hidden by default, revealed on demand
  const [stepsRevealed, setStepsRevealed] = useState(false)

  // Reset hints when lab changes
  useEffect(() => {
    setHintsRevealed(0)
    setHintsOpen(false)
    setStepsRevealed(false)
    setVerifyResult(null)
  }, [labId])

  // Derived state
  const isRunning = session?.status === 'running'
  const isStarting = session?.status === 'starting' || startSession.isPending || resetSession.isPending
  const isStopped = session?.status === 'stopped' || !session || session.status === 'none'
  const sessionError = session?.status === 'error'

  // Warn before the sandbox is lost — tab close/refresh (beforeunload) and
  // browser back button (popstate) both need separate handling since SPA
  // navigation doesn't trigger beforeunload.
  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isRunningRef.current) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // Only touch the history stack while a session is actually running — no
  // sentinel entry (and thus no extra back press) when idle/stopped.
  const sentinelPushedRef = useRef(false)
  const allowNextPopRef = useRef(false)

  useEffect(() => {
    if (isRunning && !sentinelPushedRef.current) {
      window.history.pushState({ labGuard: true }, "", window.location.href)
      sentinelPushedRef.current = true
    }
  }, [isRunning])

  useEffect(() => {
    const handlePopState = () => {
      if (allowNextPopRef.current) {
        // We triggered this pop ourselves after a confirmed leave — let it
        // through without re-prompting or re-pushing the sentinel.
        allowNextPopRef.current = false
        sentinelPushedRef.current = false
        return
      }
      if (!isRunningRef.current) return

      const confirmed = window.confirm(
        "Your lab sandbox is still running. Leaving will keep it running in the background, but any unsaved terminal output will be lost. Leave anyway?"
      )
      if (confirmed) {
        allowNextPopRef.current = true
        window.history.back()
      } else {
        window.history.pushState({ labGuard: true }, "", window.location.href)
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [])

  const confirmNavigateAway = useCallback((): boolean => {
    if (!isRunning) return true
    return window.confirm(
      "Your lab sandbox is still running. Leaving will keep it running in the background, but any unsaved terminal output will be lost. Leave anyway?"
    )
  }, [isRunning])

  const handleCatalogClick = useCallback((e: MouseEvent) => {
    if (!confirmNavigateAway()) {
      e.preventDefault()
    }
  }, [confirmNavigateAway])

  const handleStart = () => startSession.mutate({ labId })
  const handleStop = () => stopSession.mutate({ labId })
  const handleReset = () => {
    if (confirm("Are you sure you want to reset the sandbox? All changes will be lost.")) {
      resetSession.mutate({ labId })
    }
  }
  
  const handleVerify = () => {
    verifyLab.mutate({ labId }, {
      onSuccess: (res) => {
        setVerifyResult(res)
      }
    })
  }

  // Active terminal tab
  const [activeTerminal, setActiveTerminal] = useState<string>("")
  useEffect(() => {
    if (lab?.terminals?.length && !activeTerminal) {
      setActiveTerminal(lab.terminals[0])
    }
  }, [lab, activeTerminal])

  const hints = (lab as any)?.hints as string[] | undefined
  const totalHints = hints?.length ?? 0

  // Some labs embed a "## Steps" heading directly in the instructions
  // markdown. Split that section out so it can be hidden behind the same
  // reveal control as Objectives, instead of always being visible.
  //
  // Line-oriented (not a single regex over the raw string) so it: matches
  // "## Steps" whether or not it's the very first line, tolerates up to
  // three leading spaces (still a valid Markdown heading), and ignores any
  // "##"-looking text inside fenced code blocks.
  const { mainInstructions, stepsMarkdown } = useMemo(() => {
    const text = lab?.instructions || ""
    const lines = text.split("\n")
    const headingRe = /^ {0,3}##\s+(.*)$/
    const stepsHeadingRe = /^ {0,3}##\s+Steps\b/i

    let inFence = false
    let stepsStart = -1
    let stepsEnd = lines.length

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^\s*```/.test(line)) {
        inFence = !inFence
        continue
      }
      if (inFence) continue

      if (stepsStart === -1) {
        if (stepsHeadingRe.test(line)) stepsStart = i
      } else if (headingRe.test(line)) {
        stepsEnd = i
        break
      }
    }

    if (stepsStart === -1) {
      return { mainInstructions: text, stepsMarkdown: null as string | null }
    }

    // Keep everything outside the Steps block (before it AND any sections
    // after it, e.g. "## Credentials") in the always-visible instructions —
    // only the Steps block itself is gated behind the reveal button.
    const before = lines.slice(0, stepsStart).join("\n").trim()
    const after = lines.slice(stepsEnd).join("\n").trim()
    return {
      mainInstructions: [before, after].filter(Boolean).join("\n\n"),
      stepsMarkdown: lines.slice(stepsStart, stepsEnd).join("\n").trim(),
    }
  }, [lab?.instructions])

  if (labLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="h-14 border-b border-border bg-card flex items-center px-4">
          <Skeleton className="h-6 w-32" />
        </header>
        <div className="flex-1 p-6 flex gap-6">
          <Skeleton className="h-full w-1/3 rounded-lg" />
          <Skeleton className="h-full w-2/3 rounded-lg" />
        </div>
      </div>
    )
  }

  if (labError || !lab) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Lab Not Found</h2>
          <p className="text-muted-foreground mb-6">The requested lab could not be loaded or doesn't exist.</p>
          <Link href="/" className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="w-4 h-4 mr-2" /> Return to Catalog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-border bg-card flex items-center justify-between px-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            onClick={handleCatalogClick}
            className="text-muted-foreground hover:text-foreground transition-colors flex items-center text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Catalog
          </Link>
          <div className="w-px h-4 bg-border" />
          <h1 className="font-semibold flex items-center">
            <Terminal className="w-4 h-4 mr-2 text-primary" />
            {lab.title}
          </h1>
          <Badge variant={lab.difficulty === "advanced" ? "destructive" : lab.difficulty === "intermediate" ? "secondary" : "default"} className="ml-2">
            {lab.difficulty}
          </Badge>
        </div>

        <div className="flex items-center space-x-2">
          {sessionLoading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Checking session...
            </div>
          ) : (
            <>
              {sessionError && (
                <div className="flex items-center text-sm text-destructive mr-4">
                  <AlertCircle className="w-4 h-4 mr-1.5" />
                  {session.errorMessage || "Session Error"}
                </div>
              )}
              
              <div className="flex items-center space-x-1 border border-border rounded-md p-1 bg-background">
                <div className={`px-2 py-1 text-xs font-mono rounded ${isRunning ? 'text-green-400 bg-green-400/10' : isStarting ? 'text-yellow-400 bg-yellow-400/10' : 'text-muted-foreground'}`}>
                  {isStarting ? (
                    <span className="flex items-center"><RefreshCw className="w-3 h-3 mr-1 animate-spin"/> Starting</span>
                  ) : isRunning ? (
                    <span className="flex items-center"><Activity className="w-3 h-3 mr-1"/> Running</span>
                  ) : (
                    <span className="flex items-center"><Square className="w-3 h-3 mr-1"/> Stopped</span>
                  )}
                </div>
                
                {(!isRunning && !isStarting) && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-primary/20 hover:text-primary" onClick={handleStart} disabled={startSession.isPending}>
                    <Play className="w-3 h-3 mr-1" /> Start
                  </Button>
                )}
                
                {isRunning && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-destructive/20 hover:text-destructive" onClick={handleStop} disabled={stopSession.isPending}>
                      <Square className="w-3 h-3 mr-1" /> Stop
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 hover:bg-yellow-500/20 hover:text-yellow-500" onClick={handleReset} disabled={resetSession.isPending}>
                      <RotateCcw className="w-3 h-3 mr-1" /> Reset
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Instructions & Checks */}
        <div className="w-[450px] shrink-0 border-r border-border bg-card flex flex-col">
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{mainInstructions || "No instructions provided."}</ReactMarkdown>
            </div>

            {/* ── Steps Panel (hidden until revealed) ── */}
            {stepsMarkdown && (
              <div className="mt-6">
                {stepsRevealed ? (
                  <div className="prose prose-invert prose-sm max-w-none animate-in fade-in slide-in-from-top-2 duration-300">
                    <ReactMarkdown>{stepsMarkdown}</ReactMarkdown>
                  </div>
                ) : (
                  <button
                    onClick={() => setStepsRevealed(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-md border border-dashed border-border text-muted-foreground text-sm font-medium hover:bg-secondary/50 hover:text-foreground transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Reveal the steps for this lab
                  </button>
                )}
              </div>
            )}

            {/* ── Hints Panel ── */}
            {totalHints > 0 && (
              <div className="mt-6 rounded-lg border border-amber-500/25 bg-amber-500/5 overflow-hidden">
                <button
                  onClick={() => setHintsOpen(o => !o)}
                  className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-amber-500/10 transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-amber-300">
                    Hints
                    {hintsRevealed > 0 && (
                      <span className="ml-2 text-xs text-amber-400/70">
                        ({hintsRevealed} of {totalHints} revealed)
                      </span>
                    )}
                  </span>
                  {hintsOpen
                    ? <ChevronDown className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                    : <ChevronRight className="w-3.5 h-3.5 text-amber-400/60 shrink-0" />
                  }
                </button>

                {hintsOpen && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Already-revealed hints */}
                    {hintsRevealed > 0 && (
                      <div className="space-y-2">
                        {hints!.slice(0, hintsRevealed).map((hint, i) => (
                          <div
                            key={i}
                            className="flex gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-top-2 duration-300"
                          >
                            <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                              {i + 1}
                            </span>
                            <p className="text-xs text-amber-100/90 leading-relaxed font-mono">
                              {hint}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reveal next button */}
                    {hintsRevealed < totalHints ? (
                      <button
                        onClick={() => setHintsRevealed(n => n + 1)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-md border border-amber-500/30 text-amber-400 text-xs font-medium hover:bg-amber-500/10 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {hintsRevealed === 0
                          ? `Show hint (${totalHints} available)`
                          : `Show next hint (${totalHints - hintsRevealed} remaining)`
                        }
                      </button>
                    ) : (
                      <p className="text-center text-xs text-amber-400/50 py-1">
                        All hints revealed
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {lab.tasks && lab.tasks.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4 border-b border-border pb-2">Objectives</h3>

                <ul className="space-y-3">
                  {lab.tasks.map((task, i) => (
                    <li key={task.id} className="flex items-start text-sm bg-background p-3 rounded border border-border/50">
                      <div className="w-5 h-5 shrink-0 rounded-full border border-primary/50 bg-primary/10 text-primary flex items-center justify-center mr-3 mt-0.5 text-xs font-semibold">
                        {i + 1}
                      </div>
                      <span className="text-muted-foreground">{task.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          {/* Action / Verify Panel */}
          <div className="p-4 border-t border-border bg-background/50">
            <Button 
              className="w-full font-bold shadow-md shadow-primary/20" 
              size="lg"
              onClick={handleVerify}
              disabled={!isRunning || verifyLab.isPending}
            >
              {verifyLab.isPending ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Running Checks...</>
              ) : (
                <><CheckCircle2 className="w-5 h-5 mr-2" /> Run Checks</>
              )}
            </Button>
            
            {/* Verify Results */}
            {verifyResult && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className={`p-4 rounded-md border ${verifyResult.passed ? 'bg-green-950/20 border-green-900/50' : 'bg-red-950/20 border-red-900/50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      {verifyResult.passed ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mr-2" />
                      )}
                      <span className="font-semibold text-base">{verifyResult.passed ? 'Lab Passed!' : 'Checks Failed'}</span>
                    </div>
                    <div className="font-mono text-xl font-bold">
                      {verifyResult.score}%
                    </div>
                  </div>
                  
                  <div className="space-y-2 mt-4 pt-4 border-t border-border/50">
                    {verifyResult.checks?.map((check: any) => (
                      <div key={check.id} className="text-sm">
                        <div className="flex items-center mb-1">
                          {check.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500 mr-2 shrink-0" />
                          )}
                          <span className={check.passed ? "text-foreground" : "text-foreground font-medium"}>
                            {check.label}
                          </span>
                        </div>
                        {check.message && (
                          <div className={`text-xs ml-5.5 ${check.passed ? "text-muted-foreground" : "text-red-400"}`}>
                            {check.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Terminal */}
        <div className="flex-1 bg-[#09090b] flex flex-col relative">
          {!isRunning && !isStarting && (
            <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <Terminal className="w-16 h-16 text-muted-foreground opacity-50 mb-4" />
              <h2 className="text-2xl font-bold mb-2">Sandbox Offline</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Start the lab session to provision your isolated Linux environment.
              </p>
              <Button onClick={handleStart} size="lg" disabled={startSession.isPending}>
                <Play className="w-5 h-5 mr-2" /> Start Sandbox
              </Button>
            </div>
          )}

          {isStarting && (
            <div className="absolute inset-0 z-10 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <RefreshCw className="w-16 h-16 text-primary opacity-80 mb-6 animate-spin" />
              <h2 className="text-2xl font-bold mb-2">Provisioning Environment</h2>
              <p className="text-muted-foreground max-w-md">
                Starting containers, attaching networks, and configuring your sandbox. This usually takes 10-30 seconds.
              </p>
              <div className="w-64 h-2 bg-secondary rounded-full mt-6 overflow-hidden">
                <div className="h-full bg-primary animate-pulse w-full origin-left" />
              </div>
            </div>
          )}

          {lab.terminals && lab.terminals.length > 0 ? (
            <Tabs 
              value={activeTerminal} 
              onValueChange={setActiveTerminal} 
              className="flex-1 flex flex-col w-full h-full"
            >
              <div className="bg-card border-b border-border px-2 pt-2 shrink-0">
                <TabsList className="bg-transparent border-none w-full justify-start h-auto p-0 space-x-1">
                  {lab.terminals.map(term => (
                    <TabsTrigger 
                      key={term} 
                      value={term}
                      className="data-[state=active]:bg-[#09090b] data-[state=active]:text-primary data-[state=active]:border-t-2 data-[state=active]:border-t-primary rounded-none rounded-t-md px-4 py-2 text-sm font-mono border border-transparent border-b-0"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-2" />
                      {term}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              <div className="flex-1 relative bg-[#09090b]">
                {lab.terminals.map(term => (
                  <TabsContent 
                    key={term} 
                    value={term}
                    className="absolute inset-0 m-0 border-none rounded-none focus-visible:ring-0 focus-visible:outline-none"
                    forceMount
                  >
                    <div className={activeTerminal === term ? "h-full" : "hidden"}>
                      {isRunning && (
                        <TerminalComponent 
                          labId={labId} 
                          terminalName={term} 
                          className="h-full w-full border-none rounded-none" 
                        />
                      )}
                    </div>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground border-t border-border">
              <p>No terminal targets defined for this lab.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
