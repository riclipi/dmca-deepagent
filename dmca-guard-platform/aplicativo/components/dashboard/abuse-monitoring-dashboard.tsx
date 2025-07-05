'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/use-toast'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  Ban,
  TrendingUp,
  TrendingDown,
  Clock,
  User,
  Activity,
  BarChart
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

interface AbuseScore {
  id: string
  userId: string
  user: {
    name: string
    email: string
    planType: string
  }
  currentScore: number
  state: 'CLEAN' | 'WARNING' | 'HIGH_RISK' | 'BLOCKED'
  lastViolation: string | null
  violations: AbuseViolation[]
}

interface AbuseViolation {
  id: string
  type: string
  severity: number
  description: string
  occurredAt: string
}

interface AbuseStats {
  totalUsers: number
  cleanUsers: number
  warningUsers: number
  highRiskUsers: number
  blockedUsers: number
  recentViolations: number
  averageScore: number
}

const STATE_COLORS = {
  CLEAN: '#10b981',
  WARNING: '#f59e0b',
  HIGH_RISK: '#ef4444',
  BLOCKED: '#6b7280',
}

const STATE_ICONS = {
  CLEAN: CheckCircle,
  WARNING: AlertTriangle,
  HIGH_RISK: AlertCircle,
  BLOCKED: Ban,
}

export function AbuseMonitoringDashboard() {
  const [abuseScores, setAbuseScores] = useState<AbuseScore[]>([])
  const [stats, setStats] = useState<AbuseStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'score' | 'recent'>('score')
  const { toast } = useToast()

  // Fetch abuse data
  const fetchAbuseData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch abuse scores
      const scoresRes = await fetch('/api/security/abuse-scores')
      if (!scoresRes.ok) throw new Error('Failed to fetch abuse scores')
      const scoresData = await scoresRes.json()
      setAbuseScores(scoresData.data)

      // Fetch stats
      const statsRes = await fetch('/api/security/abuse-stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData.data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load abuse data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAbuseData()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAbuseData, 30000)
    return () => clearInterval(interval)
  }, [fetchAbuseData])

  // Handle user actions
  const handleResetScore = async (userId: string) => {
    try {
      const res = await fetch(`/api/security/abuse-scores/${userId}/reset`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to reset score')

      toast({
        title: 'Score reset',
        description: 'User abuse score has been reset successfully.',
      })

      fetchAbuseData()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to reset abuse score.',
        variant: 'destructive',
      })
    }
  }

  const handleBlockUser = async (userId: string) => {
    try {
      const res = await fetch(`/api/security/abuse-scores/${userId}/block`, {
        method: 'POST',
      })

      if (!res.ok) throw new Error('Failed to block user')

      toast({
        title: 'User blocked',
        description: 'User has been blocked due to security violations.',
        variant: 'destructive',
      })

      fetchAbuseData()
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to block user.',
        variant: 'destructive',
      })
    }
  }

  // Filter and sort data
  const filteredScores = abuseScores
    .filter(score => selectedState === 'all' || score.state === selectedState)
    .sort((a, b) => {
      if (sortBy === 'score') {
        return b.currentScore - a.currentScore
      } else {
        const aTime = a.lastViolation ? new Date(a.lastViolation).getTime() : 0
        const bTime = b.lastViolation ? new Date(b.lastViolation).getTime() : 0
        return bTime - aTime
      }
    })

  // Prepare chart data
  const stateDistribution = stats ? [
    { name: 'Clean', value: stats.cleanUsers, color: STATE_COLORS.CLEAN },
    { name: 'Warning', value: stats.warningUsers, color: STATE_COLORS.WARNING },
    { name: 'High Risk', value: stats.highRiskUsers, color: STATE_COLORS.HIGH_RISK },
    { name: 'Blocked', value: stats.blockedUsers, color: STATE_COLORS.BLOCKED },
  ] : []

  if (loading) {
    return <AbuseMonitoringSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Monitored accounts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Score</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageScore.toFixed(1)}</div>
              <Progress value={stats.averageScore} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Violations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentViolations}</div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Blocked Users</CardTitle>
              <Ban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.blockedUsers}</div>
              <p className="text-xs text-muted-foreground">
                Security threats
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* State Distribution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>User State Distribution</CardTitle>
          <CardDescription>
            Current security status of all monitored users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stateDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stateDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>User Abuse Scores</CardTitle>
              <CardDescription>
                Monitor and manage user security scores
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="CLEAN">Clean</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="HIGH_RISK">High Risk</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Score</SelectItem>
                  <SelectItem value="recent">Recent Activity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Last Violation</TableHead>
                <TableHead>Recent Violations</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredScores.map((score) => {
                const StateIcon = STATE_ICONS[score.state]
                const recentViolations = score.violations.filter(
                  v => new Date(v.occurredAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
                ).length

                return (
                  <TableRow key={score.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{score.user.name}</p>
                        <p className="text-sm text-muted-foreground">{score.user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{score.user.planType}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{score.currentScore}</span>
                        <Progress 
                          value={Math.min(score.currentScore, 100)} 
                          className="w-[60px]"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StateIcon 
                          className="h-4 w-4" 
                          style={{ color: STATE_COLORS[score.state] }}
                        />
                        <Badge 
                          variant={score.state === 'CLEAN' ? 'default' : 'destructive'}
                        >
                          {score.state}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      {score.lastViolation ? (
                        <span className="text-sm">
                          {formatDistanceToNow(new Date(score.lastViolation), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {recentViolations > 0 ? (
                        <Badge variant="destructive">{recentViolations}</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {score.state !== 'BLOCKED' && score.state !== 'CLEAN' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetScore(score.userId)}
                          >
                            Reset
                          </Button>
                        )}
                        {score.state === 'HIGH_RISK' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleBlockUser(score.userId)}
                          >
                            Block
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

function AbuseMonitoringSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    </div>
  )
}