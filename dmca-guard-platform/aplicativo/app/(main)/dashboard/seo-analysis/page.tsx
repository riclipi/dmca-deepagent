"use client"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Flag, ExternalLink, AlertTriangle, CheckCircle, Eye, RefreshCw, Globe } from 'lucide-react'
import { toast } from 'sonner'

interface SearchResult {
  position: number
  url: string
  title: string
  snippet?: string
  thumbnail?: string
  type: 'web' | 'image' | 'video'
  purity: 'safe' | 'contains_keyword' | 'infringement' | 'flagged'
  infringementCount?: number
}

interface BrandProfile {
  id: string
  brandName: string
  safeKeywords: string[]
  moderateKeywords: string[]
  dangerousKeywords: string[]
}

export default function SEOAnalysisPage() {
  const { data: session } = useSession()
  const [selectedKeyword, setSelectedKeyword] = useState("")
  const [selectedProfile, setSelectedProfile] = useState("")
  const [activeTab, setActiveTab] = useState("web")
  const [resultsCount, setResultsCount] = useState(10)
  const [isLoading, setIsLoading] = useState(false)
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [searchResults, setSearchResults] = useState<Record<string, SearchResult[]>>({
    web: [],
    images: [],
    videos: []
  })
  
  // Load brand profiles on mount
  useEffect(() => {
    if (session?.user?.id) {
      fetchBrandProfiles()
    }
  }, [session])

  const fetchBrandProfiles = async () => {
    try {
      const response = await fetch('/api/brand-profiles')
      if (response.ok) {
        const data = await response.json()
        setBrandProfiles(data.brandProfiles || [])
        
        // Set first profile as default
        if (data.brandProfiles && data.brandProfiles.length > 0) {
          const firstProfile = data.brandProfiles[0]
          setSelectedProfile(firstProfile.id)
          
          // Set first safe keyword as default
          if (firstProfile.safeKeywords && firstProfile.safeKeywords.length > 0) {
            setSelectedKeyword(firstProfile.safeKeywords[0])
          }
        }
      }
    } catch (error) {
      console.error('Error fetching brand profiles:', error)
      toast.error('Erro ao carregar perfis de marca')
    }
  }

  const performSearch = async () => {
    if (!selectedKeyword || !selectedProfile) {
      toast.error('Selecione um perfil e keyword para buscar')
      return
    }

    setIsLoading(true)
    
    try {
      // Mock search results - in real implementation, this would call Google Search API
      const mockResults = generateMockResults(selectedKeyword)
      setSearchResults(mockResults)
      
      toast.success('Busca realizada com sucesso!')
    } catch (error) {
      console.error('Error performing search:', error)
      toast.error('Erro ao realizar busca')
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockResults = (keyword: string): Record<string, SearchResult[]> => {
    const domains = [
      'instagram.com',
      'twitter.com',
      'x.com', 
      'onlyfans.com',
      'reddit.com',
      'telegram.me',
      'discord.gg',
      'fapello.com',
      'thothub.tv',
      'famregistry.com'
    ]

    const generateResults = (type: 'web' | 'image' | 'video') => {
      return domains.slice(0, resultsCount).map((domain, index) => {
        const position = index + 1
        const isInfringement = Math.random() > 0.6
        const isKeywordMatch = Math.random() > 0.4
        
        return {
          position,
          url: `https://${domain}/${keyword.toLowerCase().replace(/\s+/g, '')}`,
          title: `${keyword} (@${keyword.toLowerCase().replace(/\s+/g, '')}) • ${domain}${type === 'image' ? ' photos' : type === 'video' ? ' videos' : ''}`,
          snippet: type === 'web' ? `Find ${keyword} content on ${domain}. Latest posts and updates.` : undefined,
          thumbnail: type !== 'web' ? `/api/placeholder/150/150` : undefined,
          type,
          purity: isInfringement ? 'infringement' : isKeywordMatch ? 'contains_keyword' : 'safe',
          infringementCount: isInfringement ? Math.floor(Math.random() * 25) + 1 : undefined
        } as SearchResult
      })
    }

    return {
      web: generateResults('web'),
      images: generateResults('image'), 
      videos: generateResults('video')
    }
  }

  const handleFlagResult = async (result: SearchResult) => {
    try {
      // Mock flag action - in real implementation, this would:
      // 1. Add to takedown requests
      // 2. Update result purity to 'flagged'
      // 3. Save to database
      
      toast.success(`Resultado flagged: ${result.url}`)
      
      // Update local state
      setSearchResults(prev => ({
        ...prev,
        [activeTab]: prev[activeTab].map(r => 
          r.position === result.position 
            ? { ...r, purity: 'flagged' }
            : r
        )
      }))
    } catch (error) {
      console.error('Error flagging result:', error)
      toast.error('Erro ao flag resultado')
    }
  }

  const getPurityBadge = (purity: string, infringementCount?: number) => {
    switch (purity) {
      case "infringement":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="w-3 h-3" />
            {infringementCount ? `${infringementCount} Infringement${infringementCount > 1 ? 's' : ''}` : 'Infringement'}
          </Badge>
        )
      case "contains_keyword":
        return <Badge variant="secondary">contains keyword</Badge>
      case "flagged":
        return <Badge variant="outline" className="text-green-600 border-green-600">Flagged</Badge>
      default:
        return <Badge variant="outline" className="text-blue-600 border-blue-600">Safe</Badge>
    }
  }

  const getActionButton = (result: SearchResult) => {
    if (result.purity === 'flagged') {
      return (
        <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-600" disabled>
          <CheckCircle className="w-3 h-3" />
          Flagged
        </Button>
      )
    }
    
    return (
      <Button 
        size="sm" 
        className="gap-1" 
        onClick={() => handleFlagResult(result)}
        disabled={isLoading}
      >
        <Flag className="w-3 h-3" />
        Flag
      </Button>
    )
  }

  const selectedBrandProfile = brandProfiles.find(p => p.id === selectedProfile)
  const availableKeywords = selectedBrandProfile 
    ? [...(selectedBrandProfile.safeKeywords || []), ...(selectedBrandProfile.moderateKeywords || [])]
    : []

  const totalResults = searchResults[activeTab]?.length || 0
  const infringementResults = searchResults[activeTab]?.filter(r => r.purity === 'infringement').length || 0
  const flaggedResults = searchResults[activeTab]?.filter(r => r.purity === 'flagged').length || 0

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-purple-600 mb-2">SEO Analysis</h1>
        <p className="text-gray-600">Veja como o Google te vê para suas keywords</p>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardContent className="p-6">
          
          {/* Profile & Keyword Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-2">Perfil de Marca</label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil" />
                </SelectTrigger>
                <SelectContent>
                  {brandProfiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.brandName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Keyword</label>
              <Select value={selectedKeyword} onValueChange={setSelectedKeyword}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma keyword" />
                </SelectTrigger>
                <SelectContent>
                  {availableKeywords.map(keyword => (
                    <SelectItem key={keyword} value={keyword}>
                      {keyword}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button 
                onClick={performSearch} 
                disabled={!selectedKeyword || !selectedProfile || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Globe className="w-4 h-4 mr-2" />
                    Buscar no Google
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Current Search Info */}
          {selectedKeyword && (
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm font-medium">Veja como o Google te vê:</span>
              <Badge variant="outline" className="gap-1">
                <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                {selectedKeyword}
              </Badge>
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('pt-BR')} {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )}

          {/* Metrics Cards */}
          {totalResults > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Web", value: searchResults.web?.length || 0, icon: "🌐" },
                { label: "Videos", value: searchResults.videos?.length || 0, icon: "▶️" },
                { label: "Images", value: searchResults.images?.length || 0, icon: "📷" },
                { 
                  label: "Infringements", 
                  value: infringementResults, 
                  icon: "⚠️", 
                  className: infringementResults > 0 ? "text-red-600" : "text-gray-500" 
                }
              ].map((metric, index) => (
                <Card key={index} className="text-center p-4">
                  <div className="text-2xl mb-1">{metric.icon}</div>
                  <div className={`text-2xl font-bold ${metric.className || 'text-purple-600'}`}>
                    {metric.value}
                  </div>
                  <div className="text-sm text-gray-500">{metric.label}</div>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {totalResults > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="w-6 h-6 bg-purple-600 rounded text-white text-xs flex items-center justify-center">G</div>
                Google {activeTab === 'web' ? 'Web Search' : activeTab === 'images' ? 'Images' : 'Videos'}
              </CardTitle>
              
              <div className="flex items-center gap-2">
                <span className="text-sm">Showing</span>
                <Select value={resultsCount.toString()} onValueChange={(v) => setResultsCount(Number(v))}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm">results</span>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="web">Web Search</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
                <TabsTrigger value="videos">Videos</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab}>
                {/* Results Table */}
                <div className="space-y-1">
                  {/* Header */}
                  <div className={`grid gap-4 p-3 text-sm font-medium text-gray-500 border-b ${activeTab === 'web' ? 'grid-cols-12' : 'grid-cols-11'}`}>
                    <div className="col-span-1">Position</div>
                    <div className="col-span-3">Link</div>
                    <div className="col-span-3">Title</div>
                    {activeTab !== 'web' && <div className="col-span-1">Image</div>}
                    <div className="col-span-2">Purity</div>
                    <div className="col-span-1">Action</div>
                  </div>

                  {/* Results */}
                  {searchResults[activeTab]?.slice(0, resultsCount).map((result, index) => (
                    <div key={index} className={`grid gap-4 p-3 hover:bg-gray-50 border-b ${activeTab === 'web' ? 'grid-cols-12' : 'grid-cols-11'}`}>
                      
                      {/* Position */}
                      <div className="col-span-1 flex items-center">
                        <div className="w-6 h-6 bg-blue-600 text-white text-xs rounded flex items-center justify-center">
                          {result.position}
                        </div>
                      </div>

                      {/* Link */}
                      <div className="col-span-3 flex items-center">
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-green-600 hover:underline text-sm truncate flex items-center gap-1"
                        >
                          <span className="truncate">{result.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </div>

                      {/* Title */}
                      <div className="col-span-3 flex items-center">
                        <span className="text-sm">{result.title}</span>
                      </div>

                      {/* Image (for images/videos tab) */}
                      {activeTab !== 'web' && (
                        <div className="col-span-1 flex items-center">
                          {result.thumbnail ? (
                            <img 
                              src={result.thumbnail} 
                              alt="Thumbnail" 
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                              <Eye className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Purity */}
                      <div className="col-span-2 flex items-center">
                        {getPurityBadge(result.purity, result.infringementCount)}
                      </div>

                      {/* Action */}
                      <div className="col-span-1 flex items-center">
                        {getActionButton(result)}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && totalResults === 0 && selectedKeyword && (
        <Card className="text-center p-8">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            Nenhum resultado encontrado
          </h3>
          <p className="text-gray-500">
            Clique em "Buscar no Google" para analisar os resultados da keyword "{selectedKeyword}"
          </p>
        </Card>
      )}
    </div>
  )
}