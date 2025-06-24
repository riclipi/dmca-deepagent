'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, X, ArrowLeft, Shield, Globe, ListChecks, Clock } from 'lucide-react' // Relevant icons
import { toast } from 'sonner'
import Link from 'next/link'

// Assumed interface for BrandProfile (for the dropdown)
interface BrandProfileMin {
  id: string
  brandName: string
}

export default function NewMonitoringSessionPage() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    brandProfileId: '',
    targetPlatforms: [''], // e.g., ['Instagram', 'Twitter', 'OnlyFans']
    searchTerms: [''],    // e.g., ['My Content Leak', 'My Name Official']
    scanFrequency: 24,   // Default to 24 hours
  })
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileMin[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingBrandProfiles, setIsFetchingBrandProfiles] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchBrandProfiles = async () => {
      setIsFetchingBrandProfiles(true)
      try {
        // TODO: Add userId query parameter if your API requires it
        const response = await fetch('/api/brand-profiles')
        if (response.ok) {
          const data = await response.json()
          setBrandProfiles(data) // Assuming API returns an array of brand profiles
        } else {
          toast.error('Erro ao carregar perfis de marca.')
        }
      } catch (error) {
        toast.error('Erro ao conectar com o servidor para carregar perfis.')
      } finally {
        setIsFetchingBrandProfiles(false)
      }
    }
    fetchBrandProfiles()
  }, [])

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleBrandProfileChange = (value: string) => {
    setFormData(prev => ({ ...prev, brandProfileId: value }))
  }

  const handleArrayChange = (field: 'targetPlatforms' | 'searchTerms', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'targetPlatforms' | 'searchTerms') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayItem = (field: 'targetPlatforms' | 'searchTerms', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { name, description, brandProfileId, targetPlatforms, searchTerms, scanFrequency } = formData

    // Basic Validations
    if (!name.trim()) {
      toast.error('Nome da sessão é obrigatório.')
      setIsLoading(false)
      return
    }
    if (!brandProfileId) {
      toast.error('Perfil de Marca é obrigatório.')
      setIsLoading(false)
      return
    }
    const filteredPlatforms = targetPlatforms.filter(p => p.trim() !== '')
    if (filteredPlatforms.length === 0) {
      toast.error('Pelo menos uma plataforma alvo é obrigatória.')
      setIsLoading(false)
      return
    }
    const filteredSearchTerms = searchTerms.filter(st => st.trim() !== '')
    if (filteredSearchTerms.length === 0) {
      toast.error('Pelo menos um termo de busca é obrigatório.')
      setIsLoading(false)
      return
    }
    if (scanFrequency <= 0) {
      toast.error('Frequência de varredura deve ser maior que zero.')
      setIsLoading(false)
      return
    }

    try {
      // TODO: Add userId to the payload if your API requires it
      const response = await fetch('/api/monitoring-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          brandProfileId,
          targetPlatforms: filteredPlatforms,
          searchTerms: filteredSearchTerms,
          scanFrequency: Number(scanFrequency),
          // isActive: true, // Assuming new sessions are active by default, or API handles this
        })
      })

      if (response.ok) {
        toast.success('Sessão de monitoramento criada com sucesso!')
        router.push('/monitoring')
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || 'Erro ao criar sessão de monitoramento')
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error('Erro ao conectar com o servidor.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>

      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link href="/monitoring" className="inline-flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Sessões
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Nova Sessão de Monitoramento
          </h1>
          <p className="text-muted-foreground">
            Configure uma nova varredura para detectar conteúdo infrator.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle>Detalhes da Sessão</CardTitle>
              </div>
              <CardDescription>
                Forneça as informações para configurar o monitoramento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome da Sessão */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Sessão *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Monitoramento Principal Instagram"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Perfil de Marca */}
                <div className="space-y-2">
                  <Label htmlFor="brandProfileId">Perfil de Marca *</Label>
                  <Select
                    value={formData.brandProfileId}
                    onValueChange={handleBrandProfileChange}
                    required
                    disabled={isLoading || isFetchingBrandProfiles}
                  >
                    <SelectTrigger id="brandProfileId">
                      <SelectValue placeholder={isFetchingBrandProfiles ? "Carregando perfis..." : "Selecione um perfil"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isFetchingBrandProfiles ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : brandProfiles.length === 0 ? (
                        <SelectItem value="no-profiles" disabled>Nenhum perfil de marca encontrado</SelectItem>
                      ) : (
                        brandProfiles.map(profile => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.brandName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                   {brandProfiles.length === 0 && !isFetchingBrandProfiles && (
                     <p className="text-sm text-muted-foreground">
                       Você precisa criar um <Link href="/brand-profiles/new" className="text-primary hover:underline">Perfil de Marca</Link> antes de criar uma sessão.
                     </p>
                   )}
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva o objetivo desta sessão de monitoramento..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                {/* Plataformas Alvo */}
                <div className="space-y-2">
                  <Label className="flex items-center"><Globe className="h-4 w-4 mr-2 text-muted-foreground" /> Plataformas Alvo *</Label>
                  <p className="text-sm text-muted-foreground">
                    Nomes das plataformas a serem monitoradas (Ex: Instagram, Telegram, Reddit).
                  </p>
                  {formData.targetPlatforms.map((platform, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="Ex: Instagram"
                        value={platform}
                        onChange={(e) => handleArrayChange('targetPlatforms', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.targetPlatforms.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeArrayItem('targetPlatforms', index)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('targetPlatforms')}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Plataforma
                  </Button>
                </div>

                {/* Termos de Busca */}
                <div className="space-y-2">
                  <Label className="flex items-center"><ListChecks className="h-4 w-4 mr-2 text-muted-foreground" /> Termos de Busca *</Label>
                  <p className="text-sm text-muted-foreground">
                    Termos que serão usados para encontrar conteúdo (Ex: nome, @username).
                  </p>
                  {formData.searchTerms.map((term, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="Ex: Nome Artístico Oficial"
                        value={term}
                        onChange={(e) => handleArrayChange('searchTerms', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.searchTerms.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeArrayItem('searchTerms', index)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addArrayItem('searchTerms')}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Termo
                  </Button>
                </div>

                {/* Frequência de Varredura */}
                <div className="space-y-2">
                  <Label htmlFor="scanFrequency" className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-muted-foreground" /> Frequência de Varredura (horas) *
                  </Label>
                  <Input
                    id="scanFrequency"
                    type="number"
                    min="1"
                    placeholder="Ex: 24"
                    value={formData.scanFrequency}
                    onChange={(e) => handleChange('scanFrequency', parseInt(e.target.value, 10) || 1)}
                    required
                    disabled={isLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Intervalo entre as varreduras automáticas em horas.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button type="submit" disabled={isLoading || isFetchingBrandProfiles} className="flex-1">
                    {isLoading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Criando Sessão...
                      </>
                    ) : (
                      'Criar Sessão de Monitoramento'
                    )}
                  </Button>
                  <Link href="/monitoring">
                    <Button variant="outline" disabled={isLoading} className="w-full sm:w-auto">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      <Footer />
    </>
  )
}
