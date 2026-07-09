import { Link } from "wouter"
import { useListLabs, useListProgress } from "@workspace/api-client-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Terminal, Clock, CheckCircle2, PlayCircle, Trophy } from "lucide-react"
import { useMemo } from "react"

export default function Catalog() {
  const { data: labs, isLoading: labsLoading } = useListLabs()
  const { data: progress, isLoading: progressLoading } = useListProgress()

  const progressByLabId = useMemo(() => {
    if (!progress) return {}
    return progress.reduce((acc, entry) => {
      acc[entry.labId] = entry
      return acc
    }, {} as Record<string, any>)
  }, [progress])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/20 p-2 rounded-md border border-primary/30">
              <Terminal className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Linux Labs</h1>
              <p className="text-muted-foreground text-sm">Professional hands-on skill validation</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold tracking-tight">Lab Catalog</h2>
        </div>

        {labsLoading || progressLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="flex flex-col">
                <CardHeader>
                  <Skeleton className="h-6 w-2/3 mb-2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex gap-2 mb-4">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : !labs?.length ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg bg-card/50">
            <Terminal className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-1">No labs available</h3>
            <p className="text-muted-foreground">The catalog is currently empty. Check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {labs.map(lab => {
              const labProgress = progressByLabId[lab.id]
              const isPassed = labProgress?.status === "passed"
              const isInProgress = labProgress?.status === "in_progress"

              return (
                <Card key={lab.id} className="flex flex-col hover:border-primary/50 transition-colors group">
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant={lab.difficulty === "advanced" ? "destructive" : lab.difficulty === "intermediate" ? "secondary" : "default"}>
                        {lab.difficulty}
                      </Badge>
                      {isPassed && <Badge variant="success" className="bg-green-900/40 text-green-400 border-green-800"><CheckCircle2 className="w-3 h-3 mr-1"/> Passed</Badge>}
                    </div>
                    <CardTitle className="group-hover:text-primary transition-colors">{lab.title}</CardTitle>
                    <CardDescription className="line-clamp-2 mt-1">{lab.summary}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1">
                    <div className="flex flex-col space-y-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center">
                          <Terminal className="w-4 h-4 mr-1.5 opacity-70" />
                          <span>{lab.category}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1.5 opacity-70" />
                          <span>{lab.estimatedMinutes}m est.</span>
                        </div>
                      </div>

                      {labProgress?.bestScore !== undefined && (
                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-xs font-medium flex items-center">
                              <Trophy className="w-3.5 h-3.5 mr-1 text-primary"/>
                              Best Score
                            </span>
                            <span className="text-xs font-mono">{labProgress.bestScore}%</span>
                          </div>
                          <Progress value={labProgress.bestScore} className="h-1.5" />
                        </div>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Link href={`/labs/${lab.id}`} className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
                      {isPassed ? "Review Lab" : isInProgress ? "Continue Lab" : "Start Lab"}
                      <PlayCircle className="w-4 h-4 ml-2" />
                    </Link>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
