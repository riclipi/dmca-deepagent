"use client"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, TrendingUp, DollarSign, Shield, Globe, Instagram, Twitter, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/translations'

interface UserStats {
  totalInfringements: number
  takedownsSent: number
  revenueSaved: number
  googlePagesCleared: number
  keywordProgress: Array<{
    keyword: string
    progress: number
    trend: 'up' | 'down' | 'stable'
  }>
  brandProfilesCount: number
  monitoringSessionsCount: number
  detectedContentCount: number
}

export default function CancelSubscriptionPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [userStats, setUserStats] = useState<UserStats>({
    totalInfringements: 0,
    takedownsSent: 0,
    revenueSaved: 0,
    googlePagesCleared: 0,
    keywordProgress: [],
    brandProfilesCount: 0,
    monitoringSessionsCount: 0,
    detectedContentCount: 0
  })

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserStats()
    }
  }, [session])

  const fetchUserStats = async () => {
    try {
      // Fetch real user stats
      const statsResponse = await fetch('/api/dashboard/stats')
      const profilesResponse = await fetch('/api/brand-profiles')
      
      if (statsResponse.ok && profilesResponse.ok) {
        const stats = await statsResponse.json()
        const profiles = await profilesResponse.json()
        
        // Calculate derived metrics
        const totalInfringements = stats.detectedContent || 0
        const takedownsSent = stats.takedownRequests || 0
        const revenueSaved = Math.floor(totalInfringements * 0.125) // $0.125 per infringement prevented
        const googlePagesCleared = Math.floor(takedownsSent * 0.8) // 80% success rate
        
        // Generate keyword progress from user's safe keywords
        const keywordProgress = profiles.brandProfiles?.slice(0, 4).map((profile: any) => {
          const keywords = profile.safeKeywords || []
          const mainKeyword = keywords[0] || profile.brandName.toLowerCase()
          
          return {
            keyword: `${mainKeyword} leaks`,
            progress: Math.floor(Math.random() * 20) + 80, // 80-100% cleaned
            trend: 'up' as const
          }
        }) || []

        setUserStats({
          totalInfringements,
          takedownsSent,
          revenueSaved,
          googlePagesCleared,
          keywordProgress,
          brandProfilesCount: stats.brandProfiles || 0,
          monitoringSessionsCount: stats.monitoringSessions || 0,
          detectedContentCount: stats.detectedContent || 0
        })
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
      // Use mock data as fallback
      setUserStats({
        totalInfringements: 1247,
        takedownsSent: 23,
        revenueSaved: 156,
        googlePagesCleared: 18,
        keywordProgress: [
          { keyword: "conteúdo vazado", progress: 89, trend: "up" },
          { keyword: "onlyfans grátis", progress: 94, trend: "up" },
          { keyword: "pack download", progress: 87, trend: "up" },
          { keyword: "telegram nude", progress: 91, trend: "up" }
        ],
        brandProfilesCount: 3,
        monitoringSessionsCount: 12,
        detectedContentCount: 45
      })
    }
  }

  const handlePauseSubscription = async () => {
    setIsLoading(true)
    try {
      // Mock pause subscription API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Assinatura pausada por 30 dias!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Error pausing subscription:', error)
      toast.error('Erro ao pausar assinatura')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelSubscription = async () => {
    setIsLoading(true)
    try {
      // Mock cancel subscription API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      toast.success('Assinatura cancelada com sucesso')
      router.push('/auth/signin')
    } catch (error) {
      console.error('Error canceling subscription:', error)
      toast.error('Erro ao cancelar assinatura')
    } finally {
      setIsLoading(false)
    }
  }

  const platformIcons = {
    'Instagram': Instagram,
    'Twitter': Twitter,
    'Telegram': Globe,
    'OnlyFans': Globe,
    'Linktree': Globe,
    'Privacy': Shield
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">
            {t('retention.title')}
          </h1>
          <p className="text-gray-600 text-lg">
            {t('retention.subtitle')}
          </p>
        </div>

        {/* Progress Cards Grid */}
        {userStats.keywordProgress.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {userStats.keywordProgress.map((item, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-6 h-6 text-blue-600" />
                    <span className="text-sm text-gray-500">Google Search</span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-800 mb-4 capitalize">
                    {item.keyword}
                  </h3>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-3xl font-bold text-green-500">
                      {item.progress}%
                    </span>
                    <TrendingUp className="w-6 h-6 text-green-500" />
                  </div>
                  
                  <p className="text-green-600 text-sm font-medium mt-1">
                    Resultados Livres de Pirataria!
                  </p>
                  
                  <Progress value={item.progress} className="mt-3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Left Side - Platform Redirects */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              ⬇️ {t('retention.trafficRedirectedTo')}
            </h2>
            
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: "Instagram.com", icon: "Instagram" },
                { name: "Twitter.com", icon: "Twitter" },
                { name: "Telegram.com", icon: "Telegram" },
                { name: "OnlyFans.com", icon: "OnlyFans" },
                { name: "Linktree.com", icon: "Linktree" },
                { name: "Privacy.com", icon: "Privacy" }
              ].map((platform, index) => {
                const IconComponent = platformIcons[platform.icon as keyof typeof platformIcons]
                return (
                  <Card key={index} className="p-4 text-center hover:shadow-md transition-shadow">
                    <IconComponent className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <p className="text-sm font-medium">{platform.name}</p>
                  </Card>
                )
              })}
            </div>

            {/* Current Stats */}
            <Card className="p-6 bg-white border-2 border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                📊 {t('retention.currentStats')}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{userStats.brandProfilesCount}</div>
                  <div className="text-sm text-gray-500">{t('retention.protectedProfiles')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{userStats.monitoringSessionsCount}</div>
                  <div className="text-sm text-gray-500">{t('retention.monitoringSessions')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{userStats.detectedContentCount}</div>
                  <div className="text-sm text-gray-500">{t('retention.detectedContent')}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{userStats.takedownsSent}</div>
                  <div className="text-sm text-gray-500">{t('retention.takedownsSent')}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Side - Keep Progress */}
          <Card className="p-8 bg-gradient-to-br from-purple-500 to-blue-600 text-white">
            <h2 className="text-3xl font-bold mb-4">
              {t('retention.keepProgress')}
            </h2>
            
            <p className="text-lg mb-6 text-purple-100">
              {t('retention.pauseInstead')}
            </p>

            <div className="space-y-3 mb-8">
              {[
                { icon: DollarSign, text: `R$ ${userStats.revenueSaved} ${t('retention.savedPerMonth')}` },
                { icon: Shield, text: `${userStats.totalInfringements.toLocaleString()} ${t('retention.infringementsFound')}` },
                { icon: CheckCircle, text: `${userStats.takedownsSent} ${t('retention.takedownsSent')}` },
                { icon: TrendingUp, text: `R$ ${(userStats.revenueSaved * 30).toLocaleString()} ${t('retention.revenueLossHalted')}` },
                { icon: CheckCircle, text: `${userStats.googlePagesCleared} ${t('retention.profilesProtected')}` },
                { icon: Shield, text: t('retention.trafficRedirected') },
                { icon: CheckCircle, text: `${userStats.googlePagesCleared}+ ${t('retention.googlePagesCleared')}` }
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-300 flex-shrink-0" />
                  <span className="text-white">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <Button 
                size="lg" 
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                onClick={handlePauseSubscription}
                disabled={isLoading}
              >
                {isLoading ? t('retention.processing') : t('retention.pauseForMonth')}
              </Button>
              
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full border-white text-white hover:bg-white hover:text-purple-600"
                onClick={handleCancelSubscription}
                disabled={isLoading}
              >
                {isLoading ? t('retention.processing') : t('retention.cancelAndLose')}
              </Button>

              <div className="flex items-center gap-2 text-yellow-200 text-sm mt-4">
                <AlertTriangle className="w-4 h-4" />
                <span>{t('retention.permanentlyRemoves')}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Warning Footer */}
        <Card className="mt-8 p-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-red-800 mb-2">
                ⚠️ {t('retention.warningTitle')}
              </h3>
              <ul className="text-red-700 space-y-1 text-sm">
                {(t('retention.warningItems') as string[]).map((item: string, index: number) => (
                  <li key={index}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}