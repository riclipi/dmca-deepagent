
'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Plus, 
  Shield, 
  Edit, 
  Trash2, 
  ExternalLink,
  Search,
  BarChart3
} from 'lucide-react'
import { toast } from 'sonner'

interface BrandProfile {
  id: string
  brandName: string
  description?: string
  officialUrls: string[]
  socialMedia?: any
  keywords: string[]
  isActive: boolean
  createdAt: string
  _count: {
    monitoringSessions: number
    detectedContent: number
  }
}

export default function BrandProfilesPage() {
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchBrandProfiles()
  }, [])

  const fetchBrandProfiles = async () => {
    try {
      const response = await fetch('/api/brand-profiles')
      if (response.ok) {
        const data = await response.json()
        setBrandProfiles(data)
      } else {
        toast.error('Erro ao carregar perfis de marca')
      }
    } catch (error) {
      toast.error('Erro ao carregar perfis de marca')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string, brandName: string) => {
    if (!confirm(`Tem certeza que deseja remover o perfil "${brandName}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/brand-profiles/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('Perfil removido com sucesso')
        fetchBrandProfiles()
      } else {
        toast.error('Erro ao remover perfil')
      }
    } catch (error) {
      toast.error('Erro ao remover perfil')
    }
  }

  if (isLoading) {
    return (
      <>
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
        <Footer />
      </>
    )
  }

  return (
    <>
      
      <main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Perfis de Marca
            </h1>
            <p className="text-muted-foreground">
              Gerencie suas marcas e identidades digitais
            </p>
          </div>
          
          <Link href="/brand-profiles/new">
            <Button className="mt-4 sm:mt-0">
              <Plus className="h-4 w-4 mr-2" />
              Novo Perfil
            </Button>
          </Link>
        </motion.div>

        {/* Brand Profiles Grid */}
        {brandProfiles.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brandProfiles.map((profile, index) => (
              <motion.div
                key={profile.id}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg">{profile.brandName}</CardTitle>
                      </div>
                      <StatusBadge status={profile.isActive ? 'ACTIVE' : 'PAUSED'} />
                    </div>
                    {profile.description && (
                      <CardDescription className="mt-2">
                        {profile.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* URLs Oficiais */}
                    {profile.officialUrls.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          URLs Oficiais
                        </h4>
                        <div className="space-y-1">
                          {profile.officialUrls.slice(0, 2).map((url, urlIndex) => (
                            <a
                              key={urlIndex}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-sm text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {url.length > 30 ? `${url.substring(0, 30)}...` : url}
                            </a>
                          ))}
                          {profile.officialUrls.length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{profile.officialUrls.length - 2} mais
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Keywords */}
                    {profile.keywords.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">
                          Palavras-chave
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {profile.keywords.slice(0, 3).map((keyword, keywordIndex) => (
                            <Badge key={keywordIndex} variant="secondary" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {profile.keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{profile.keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <div className="flex items-center justify-center text-primary mb-1">
                          <Search className="h-4 w-4 mr-1" />
                          <span className="font-semibold">{profile._count.monitoringSessions}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Monitoramentos</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center text-orange-500 mb-1">
                          <BarChart3 className="h-4 w-4 mr-1" />
                          <span className="font-semibold">{profile._count.detectedContent}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Detectados</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2 pt-4">
                      <Link href={`/brand-profiles/${profile.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(profile.id, profile.brandName)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center py-16"
          >
            <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhum perfil de marca criado
            </h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Crie seu primeiro perfil de marca para começar a monitorar e proteger seu conteúdo digital.
            </p>
            <Link href="/brand-profiles/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Perfil
              </Button>
            </Link>
          </motion.div>
        )}
      </main>

      <Footer />
    </>
  )
}
