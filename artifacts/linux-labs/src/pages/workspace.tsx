import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { useParams, useLocation, Link } from "wouter"
import { 
  useGetLab, 
  useGetLabSession, 
  useStartLabSession, 
  useStopLabSession, 
  useResetLabSession, 
  useVerifyLab,
  useListProgress,
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
  Lightbulb, ChevronDown, ChevronRight, Eye, Server, Loader2, Target, Trophy
} from "lucide-react"
import { cn } from "@/lib/utils"

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

  const { data: progressList } = useListProgress()

  const verifyLab = useVerifyLab()
  const [verifyResult, setVerifyResult] = useState<any>(null)

  // Seed verifyResult from stored lastResults when progress loads or lab changes
  useEffect(() => {
    const entry = progressList?.find((p: any) => p.labId === labId)
    if (entry?.lastResults?.length) {
      setVerifyResult({
        passed: entry.status === "passed",
        score: entry.bestScore,
        checks: entry.lastResults,
      })
    } else {
      setVerifyResult(null)
    }
  }, [progressList, labId])

  // Auto-close on 100% completion (only triggered by a fresh verify, not seeded history)
  const [closeCountdown, setCloseCountdown] = useState<number | null>(null)

  useEffect(() => {
    if (closeCountdown === null) return
    if (closeCountdown === 0) {
      setLocation('/')
      return
    }
    const timer = setTimeout(() => setCloseCountdown(c => (c ?? 1) - 1), 1000)
    return () => clearTimeout(timer)
  }, [closeCountdown, setLocation])

  // Hints state
  const [hintsRevealed, setHintsRevealed] = useState(0)
  const [hintsOpen, setHintsOpen] = useState(false)

  // Steps state
  const [stepsRevealed, setStepsRevealed] = useState(false)

  // Reset when lab changes
  useEffect(() => {
    setHintsRevealed(0)
    setHintsOpen(false)
    setStepsRevealed(false)
    setVerifyResult(null)
    setCloseCountdown(null)
  }, [labId])

  // Derived state
  const isRunning = session?.status === 'running'
  const isStarting = session?.status === 'starting' || startSession.isPending || resetSession.isPending
  const isStopped = session?.status === 'stopped' || !session || session.status === 'none'
  const sessionError = session?.status === 'error'

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
        if (res.passed) {
          setCloseCountdown(15)
        }
      }
    })
  }

  const [activeTerminal, setActiveTerminal] = useState<string>("")
  useEffect(() => {
    if (lab?.terminals?.length && !activeTerminal) {
      setActiveTerminal(lab.terminals[0])
    }
  }, [lab, activeTerminal])

  const hints = (lab as any)?.hints as string[] | undefined
  const totalHints = hints?.length ?? 0

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

    const before = lines.slice(0, stepsStart).join("\n").trim()
    const after = lines.slice(stepsEnd).join("\n").trim()
    return {
      mainInstructions: [before, after].filter(Boolean).join("\n\n"),
      stepsMarkdown: lines.slice(stepsStart, stepsEnd).join("\n").trim(),
    }
  }, [lab?.instructions])

  if (labLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-primary">
          <Loader2 className="w-12 h-12 animate-spin" />
          <p className="font-mono text-sm tracking-widest uppercase">Initializing Interface...</p>
        </div>
      </div>
    )
  }

  if (labError || !lab) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md border border-destructive/20 bg-destructive/5 p-8 rounded-xl backdrop-blur-sm">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">System Error: Lab Not Found</h2>
          <p className="text-muted-foreground mb-6 font-mono text-sm">The requested environment profile could not be loaded or doesn't exist.</p>
          <Link href="/" className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-bold font-mono h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" /> RETURN_TO_BASE
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden font-sans">
      {/* ── Control Bar (Header) ── */}
      <header className="h-14 shrink-0 border-b border-border/60 bg-card/80 backdrop-blur-md flex items-center justify-between px-4 relative z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            onClick={handleCatalogClick}
            className="text-muted-foreground hover:text-primary transition-colors flex items-center text-sm font-semibold tracking-wide"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            BACK
          </Link>
          <div className="w-px h-5 bg-border/80" />
          <h1 className="font-bold flex items-center text-[15px] tracking-tight text-foreground">
            <Server className="w-4 h-4 mr-2 text-primary" />
            {lab.title}
          </h1>
          <Badge variant="outline" className={cn(
            "ml-2 font-mono text-[10px] uppercase px-2 h-5 border",
            lab.difficulty === "advanced" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : 
            lab.difficulty === "intermediate" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : 
            "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          )}>
            {lab.difficulty}
          </Badge>
        </div>

        <div className="flex items-center space-x-3">
          {sessionLoading ? (
            <div className="flex items-center text-sm font-mono text-muted-foreground">
              <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> PROBING...
            </div>
          ) : (
            <>
              {sessionError && (
                <div className="flex items-center text-sm font-mono text-destructive bg-destructive/10 px-3 py-1 rounded-md border border-destructive/20 mr-2">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {session.errorMessage || "ERR_SESSION_FAIL"}
                </div>
              )}
              
              <div className="flex items-center bg-background border border-border/80 rounded-md p-1 shadow-inner">
                {/* Status Indicator */}
                <div className={cn(
                  "px-3 py-1 text-xs font-mono font-bold rounded flex items-center gap-1.5",
                  isRunning ? "text-[#00ff9d] bg-[#00ff9d]/10" : 
                  isStarting ? "text-yellow-400 bg-yellow-400/10" : 
                  "text-muted-foreground"
                )}>
                  {isStarting ? (
                    <><RefreshCw className="w-3.5 h-3.5 animate-spin"/> BOOTING</>
                  ) : isRunning ? (
                    <><Activity className="w-3.5 h-3.5"/> ACTIVE</>
                  ) : (
                    <><Square className="w-3.5 h-3.5"/> OFFLINE</>
                  )}
                </div>
                
                <div className="w-px h-5 bg-border/50 mx-1.5" />
                
                {/* Action Buttons */}
                <div className="flex items-center space-x-1">
                  {(!isRunning && !isStarting) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-3 font-semibold hover:bg-primary/20 hover:text-primary text-foreground" onClick={handleStart} disabled={startSession.isPending}>
                      <Play className="w-3.5 h-3.5 mr-1.5" /> START
                    </Button>
                  )}
                  
                  {isRunning && (
                    <>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-3 font-semibold hover:bg-destructive/20 hover:text-destructive text-muted-foreground" onClick={handleStop} disabled={stopSession.isPending}>
                        <Square className="w-3.5 h-3.5 mr-1.5" /> STOP
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs px-3 font-semibold hover:bg-yellow-500/20 hover:text-yellow-500 text-muted-foreground" onClick={handleReset} disabled={resetSession.isPending}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> RESET
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ── Left Panel: Instructions & Objectives ── */}
        <div className="w-[450px] shrink-0 border-r border-border/50 bg-card/40 flex flex-col relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scroll-smooth">
            
            {/* Scenario Header */}
            <div className="mb-6 pb-4 border-b border-border/40">
              <h2 className="text-xl font-bold tracking-tight mb-2">Scenario</h2>
              <div className="prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground prose-headings:text-foreground prose-a:text-primary prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                <ReactMarkdown>{mainInstructions || "No instructions provided."}</ReactMarkdown>
              </div>
            </div>

            {/* ── Steps Panel ── */}
            {stepsMarkdown && (
              <div className="mb-8">
                {stepsRevealed ? (
                  <div className="p-4 rounded-xl bg-background border border-border/60 animate-in fade-in slide-in-from-top-4 duration-300">
                    <h3 className="text-sm font-bold font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" /> Execution Steps
                    </h3>
                    <div className="prose prose-invert prose-sm max-w-none prose-p:text-muted-foreground prose-ol:text-muted-foreground prose-ul:text-muted-foreground prose-li:marker:text-primary">
                      <ReactMarkdown>{stepsMarkdown}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setStepsRevealed(true)}
                    className="w-full group flex flex-col items-center justify-center gap-2 py-6 rounded-xl border border-dashed border-border/80 bg-background/50 hover:bg-primary/5 hover:border-primary/50 transition-all duration-300"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <Eye className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-muted-foreground group-hover:text-primary">Reveal Step-by-Step Guide</span>
                    <span className="text-xs font-mono text-muted-foreground/50">Only if you're stuck!</span>
                  </button>
                )}
              </div>
            )}

            {/* ── Objectives Checklist ── */}
            {lab.tasks && lab.tasks.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-bold font-mono text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" /> Objectives
                </h3>

                <ul className="space-y-2.5">
                  {lab.tasks.map((task, i) => {
                    const taskResult = verifyResult?.checks?.find((c: any) => c.id === task.id)
                    const isVerified = !!taskResult
                    const isPassed = taskResult?.passed

                    return (
                      <li key={task.id} className={cn(
                        "flex items-start text-sm p-3.5 rounded-lg border transition-all duration-300",
                        isVerified
                          ? isPassed
                            ? "bg-green-500/10 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                            : "bg-red-500/10 border-red-500/30"
                          : "bg-background border-border/60"
                      )}>
                        <div className={cn(
                          "w-6 h-6 shrink-0 rounded-full flex items-center justify-center mr-3 mt-0.5 text-xs font-bold font-mono transition-colors",
                          isVerified
                            ? isPassed
                              ? "bg-green-500 text-black"
                              : "bg-red-500 text-white"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {isVerified
                            ? isPassed
                              ? <CheckCircle2 className="w-3.5 h-3.5" />
                              : <XCircle className="w-3.5 h-3.5" />
                            : (i + 1)
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "leading-snug",
                            isVerified
                              ? isPassed
                                ? "text-green-300 font-medium"
                                : "text-red-300 font-medium"
                              : "text-muted-foreground"
                          )}>
                            {task.description}
                          </span>
                          {isVerified && taskResult?.message && (
                            <div className={cn(
                              "text-xs mt-1.5 font-mono truncate",
                              isPassed ? "text-muted-foreground" : "text-red-400"
                            )}>
                              {">"} {taskResult.message}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {/* ── Hints Panel ── */}
            {totalHints > 0 && (
              <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden backdrop-blur-sm">
                <button
                  onClick={() => setHintsOpen(o => !o)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-yellow-500/10 transition-colors"
                >
                  <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0" />
                  <span className="flex-1 text-sm font-bold text-yellow-500/90 font-mono">
                    HINTS_AVAILABLE
                    {hintsRevealed > 0 && (
                      <span className="ml-2 text-xs text-yellow-500/60 font-normal">
                        [{hintsRevealed}/{totalHints} unlocked]
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 text-yellow-500/60 shrink-0 transition-transform duration-300", hintsOpen && "rotate-180")} />
                </button>

                {hintsOpen && (
                  <div className="px-5 pb-5 space-y-3">
                    {hintsRevealed > 0 && (
                      <div className="space-y-2">
                        {hints!.slice(0, hintsRevealed).map((hint, i) => (
                          <div
                            key={i}
                            className="flex gap-3 p-3.5 rounded-lg bg-black/40 border border-yellow-500/20 animate-in fade-in slide-in-from-top-2 duration-300"
                          >
                            <span className="shrink-0 text-yellow-500/50 text-xs font-mono mt-0.5">
                              {`>_`}
                            </span>
                            <p className="text-sm text-yellow-200/80 leading-relaxed font-mono">
                              {hint}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {hintsRevealed < totalHints ? (
                      <button
                        onClick={() => setHintsRevealed(n => n + 1)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-yellow-500/30 text-yellow-500 text-xs font-bold font-mono hover:bg-yellow-500/10 transition-colors mt-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {hintsRevealed === 0
                          ? `DECRYPT_HINT (1 of ${totalHints})`
                          : `DECRYPT_NEXT_HINT (${totalHints - hintsRevealed} left)`
                        }
                      </button>
                    ) : (
                      <p className="text-center text-xs font-mono text-yellow-500/40 py-2">
                        // EOF: ALL HINTS REVEALED
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* ── Action / Verify Panel ── */}
          <div className="p-5 border-t border-border/60 bg-card relative z-20">
            <Button 
              className={cn(
                "w-full h-12 font-bold font-mono tracking-wide text-sm transition-all duration-300 relative overflow-hidden group",
                verifyLab.isPending ? "bg-primary/80" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_30px_rgba(var(--primary),0.5)]"
              )}
              onClick={handleVerify}
              disabled={!isRunning || verifyLab.isPending}
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
              
              {verifyLab.isPending ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> EXECUTING_TESTS...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> VERIFY_OBJECTIVES</>
              )}
            </Button>
            
            {/* Verify Results */}
            {verifyResult && (
              <div className="mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={cn(
                  "p-4 rounded-xl border relative overflow-hidden",
                  verifyResult.passed 
                    ? "bg-green-500/10 border-green-500/40 shadow-[0_0_30px_rgba(34,197,94,0.15)]" 
                    : "bg-red-500/10 border-red-500/40"
                )}>
                  {verifyResult.passed && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/20 blur-[40px] -mr-10 -mt-10 rounded-full" />
                  )}
                  
                  <div className="flex items-center justify-between mb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      {verifyResult.passed ? (
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                          <XCircle className="w-5 h-5 text-red-500" />
                        </div>
                      )}
                      <span className={cn("font-bold tracking-tight text-lg", verifyResult.passed ? "text-green-400" : "text-red-400")}>
                        {verifyResult.passed ? 'MISSION_ACCOMPLISHED' : 'CHECKS_FAILED'}
                      </span>
                    </div>
                    <div className={cn("font-mono text-2xl font-black", verifyResult.passed ? "text-green-400" : "text-red-400")}>
                      {verifyResult.score}%
                    </div>
                  </div>
                  
                  <p className="text-xs font-mono text-muted-foreground/60 mt-3 relative z-10">
                    {verifyResult.passed ? "// All objectives verified — see checklist above" : "// See objectives above for details"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Terminal ── */}
        <div className="flex-1 bg-[#050505] flex flex-col relative">
          
          {/* Grid background effect for the terminal area */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-20" />

          {!isRunning && !isStarting && (
            <div className="absolute inset-0 z-10 bg-[#050505]/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-muted/20 border border-border flex items-center justify-center mb-6 shadow-xl">
                <Terminal className="w-10 h-10 text-muted-foreground/60" />
              </div>
              <h2 className="text-2xl font-bold font-mono tracking-tight mb-3">CONNECTION_OFFLINE</h2>
              <p className="text-muted-foreground max-w-sm mb-8 text-sm">
                Awaiting manual start to provision your isolated Linux container environment.
              </p>
              <Button 
                onClick={handleStart} 
                size="lg" 
                className="h-12 px-8 font-bold font-mono text-sm tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(var(--primary),0.2)] hover:scale-[1.02] transition-all"
                disabled={startSession.isPending}
              >
                <Play className="w-4 h-4 mr-2" /> INITIALIZE_UPLINK
              </Button>
            </div>
          )}

          {isStarting && (
            <div className="absolute inset-0 z-10 bg-[#050505]/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <RefreshCw className="w-16 h-16 text-primary opacity-80 mb-8 animate-spin" />
              <h2 className="text-2xl font-bold font-mono tracking-tight mb-3 text-primary">PROVISIONING_ENVIRONMENT</h2>
              <p className="text-muted-foreground max-w-sm text-sm font-mono">
                Allocating containers, attaching virtual networks, and injecting profile configs...
              </p>
              <div className="w-72 h-1.5 bg-muted rounded-full mt-8 overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full bg-primary animate-[shimmer_2s_infinite] w-1/2 rounded-full" />
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-mono mt-4">Estimated time: 10-30s</p>
            </div>
          )}

          {lab.terminals && lab.terminals.length > 0 ? (
            <Tabs 
              value={activeTerminal} 
              onValueChange={setActiveTerminal} 
              className="flex-1 flex flex-col w-full h-full relative z-20"
            >
              {/* Terminal Tabs Header */}
              <div className="bg-[#0A0D14] border-b border-border/40 pt-2 px-3 shrink-0 flex justify-between items-end">
                <TabsList className="bg-transparent border-none w-full justify-start h-auto p-0 space-x-1.5">
                  {lab.terminals.map(term => (
                    <TabsTrigger 
                      key={term} 
                      value={term}
                      className="data-[state=active]:bg-[#050505] data-[state=active]:text-primary data-[state=active]:border-primary/50 rounded-none rounded-t-lg px-5 py-2.5 text-[13px] font-mono font-bold tracking-wide border border-transparent border-b-0 transition-all opacity-70 data-[state=active]:opacity-100 flex items-center"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-2 opacity-70" />
                      {term}
                      {activeTerminal === term && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse ml-3" />
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                {isRunning && (
                  <div className="pb-2.5 pr-2 hidden md:block text-[10px] font-mono text-muted-foreground/50 flex items-center gap-2">
                    <span>CONNECTED</span>
                    <span className="w-2 h-2 rounded-full bg-[#00ff9d] animate-pulse inline-block" />
                  </div>
                )}
              </div>
              
              {/* Terminal Body */}
              <div className="flex-1 relative bg-[#050505]">
                {lab.terminals.map(term => (
                  <TabsContent 
                    key={term} 
                    value={term}
                    className="absolute inset-0 m-0 border-none rounded-none focus-visible:ring-0 focus-visible:outline-none p-4"
                    forceMount
                  >
                    <div className={cn(
                      "h-full w-full rounded-md border border-border/20 overflow-hidden shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]",
                      activeTerminal === term ? "block" : "hidden"
                    )}>
                      {isRunning && (
                        <TerminalComponent 
                          labId={labId} 
                          terminalName={term} 
                          className="h-full w-full bg-transparent" 
                        />
                      )}
                    </div>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground/50 font-mono text-sm border-t border-border/20">
              <p>{`>_ NO_TERMINAL_TARGETS_DEFINED`}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Completion toast (bottom-right) ── */}
      {closeCountdown !== null && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300 w-80">
          <div className="relative rounded-xl border border-green-500/40 bg-[#0d0d0d] p-5 shadow-[0_0_40px_rgba(34,197,94,0.2)] overflow-hidden">
            {/* Glow blob */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 blur-[30px] -mr-6 -mt-6 rounded-full pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.25)] shrink-0">
                <Trophy className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-green-500/60 leading-none mb-1">Mission Complete</p>
                <p className="font-mono font-bold text-base text-green-400 leading-none">Lab Completed!</p>
              </div>
            </div>

            {/* Message */}
            <p className="relative font-mono text-xs text-muted-foreground/60 mb-4">
              Returning to lab list in{" "}
              <span className="text-green-400 font-bold tabular-nums">{closeCountdown}</span>{" "}
              second{closeCountdown !== 1 ? "s" : ""}. Take a moment to review your work.
            </p>

            {/* Progress bar (drains left-to-right over 15 s) */}
            <div className="relative h-[3px] rounded-full bg-green-500/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${((15 - closeCountdown) / 15) * 100}%`, transition: "width 1s linear" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
