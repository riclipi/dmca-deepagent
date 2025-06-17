'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation' // Added useParams
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch' // For isActive toggle
import { Search, Plus, X, ArrowLeft, Shield, Globe, ListChecks, Clock, Save } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface BrandProfileMin {
  id: string
  brandName: string
}

// Interface for Monitoring Session data for the form
interface MonitoringSessionFormData {
  name: string
  description: string
  brandProfileId: string
  targetPlatforms: string[]
  searchTerms: string[]
  scanFrequency: number
  isActive: boolean // Added for editing status
}

export default function EditMonitoringSessionPage() {
  const [formData, setFormData] = useState<MonitoringSessionFormData>({
    name: '',
    description: '',
    brandProfileId: '',
    targetPlatforms: [''],
    searchTerms: [''],
    scanFrequency: 24,
    isActive: true,
  })
  const [brandProfiles, setBrandProfiles] = useState<BrandProfileMin[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingData, setIsFetchingData] = useState(true) // For initial data load
  const router = useRouter()
  const params = useParams()
  const sessionId = params.id as string;

  useEffect(() => {
    const fetchBrandProfiles = async () => {
      try {
        // TODO: Add userId query parameter if your API requires it
        const response = await fetch('/api/brand-profiles')
        if (response.ok) {
          const data = await response.json()
          setBrandProfiles(data)
        } else {
          toast.error('Erro ao carregar perfis de marca.')
        }
      } catch (error) {
        toast.error('Erro ao conectar para carregar perfis.')
      }
    }

    const fetchSessionData = async () => {
      if (!sessionId) return;
      setIsFetchingData(true);
      try {
        const response = await fetch(`/api/monitoring-sessions/${sessionId}`)
        if (response.ok) {
          const data = await response.json()
          setFormData({
            name: data.name || '',
            description: data.description || '',
            brandProfileId: data.brandProfileId || (data.brandProfile?.id || ''), // Handle nested or direct ID
            targetPlatforms: data.targetPlatforms || [''],
            searchTerms: data.searchTerms || [''],
            scanFrequency: data.scanFrequency || 24,
            isActive: data.isActive !== undefined ? data.isActive : true,
          })
        } else {
          toast.error('Erro ao carregar dados da sessão.')
          router.push('/monitoring') // Redirect if session not found or error
        }
      } catch (error) {
        toast.error('Erro ao conectar para carregar dados da sessão.')
        router.push('/monitoring')
      } finally {
        setIsFetchingData(false)
      }
    }

    fetchBrandProfiles()
    fetchSessionData()
  }, [sessionId, router])

  const handleChange = (field: keyof MonitoringSessionFormData, value: string | number | boolean) => {
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
      [field]: (prev[field] as string[]).map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'targetPlatforms' | 'searchTerms') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as string[]), '']
    }))
  }

  const removeArrayItem = (field: 'targetPlatforms' | 'searchTerms', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field]as string[]).filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { name, description, brandProfileId, targetPlatforms, searchTerms, scanFrequency, isActive } = formData

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
      // TODO: Add userId to the payload if your API requires it for authorization
      const response = await fetch(`/api/monitoring-sessions/${sessionId}`, {
        method: 'PUT',
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
          isActive,
        })
      })

      if (response.ok) {
        toast.success('Sessão de monitoramento atualizada com sucesso!')
        router.push('/monitoring')
      } else {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || 'Erro ao atualizar sessão')
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error('Erro ao conectar com o servidor.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isFetchingData) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 flex justify-center items-center h-[calc(100vh-200px)]">
          <LoadingSpinner size="lg" />
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

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
            Editar Sessão de Monitoramento
          </h1>
          <p className="text-muted-foreground">
            Ajuste as configurações da sua varredura.
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
                Modifique as informações da sua sessão de monitoramento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome da Sessão */}
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Sessão *</Label>
                  <Input
                    id="name"
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
                    disabled={isLoading || brandProfiles.length === 0}
                  >
                    <SelectTrigger id="brandProfileId">
                      <SelectValue placeholder={brandProfiles.length === 0 ? "Carregando perfis..." : "Selecione um perfil"} />
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

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                {/* Plataformas Alvo */}
                <div className="space-y-2">
                  <Label className="flex items-center"><Globe className="h-4 w-4 mr-2 text-muted-foreground" /> Plataformas Alvo *</Label>
                  {formData.targetPlatforms.map((platform, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        value={platform}
                        onChange={(e) => handleArrayChange('targetPlatforms', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.targetPlatforms.length > 1 && (
                        <Button type="button" variant="outline" size="icon" onClick={() => removeArrayItem('targetPlatforms', index)} disabled={isLoading}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => addArrayItem('targetPlatforms')} disabled={isLoading}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Plataforma
                  </Button>
                </div>

                {/* Termos de Busca */}
                <div className="space-y-2">
                  <Label className="flex items-center"><ListChecks className="h-4 w-4 mr-2 text-muted-foreground" /> Termos de Busca *</Label>
                  {formData.searchTerms.map((term, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        value={term}
                        onChange={(e) => handleArrayChange('searchTerms', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.searchTerms.length > 1 && (
                        <Button type="button" variant="outline" size="icon" onClick={() => removeArrayItem('searchTerms', index)} disabled={isLoading}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => addArrayItem('searchTerms')} disabled={isLoading}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar Termo
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
                    value={formData.scanFrequency}
                    onChange={(e) => handleChange('scanFrequency', parseInt(e.target.value, 10) || 1)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Status (Ativo/Inativo) */}
                <div className="flex items-center space-x-2 pt-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleChange('isActive', checked)}
                    disabled={isLoading}
                  />
                  <Label htmlFor="isActive" className="cursor-pointer">
                    {formData.isActive ? 'Sessão Ativa' : 'Sessão Pausada'}
                  </Label>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button type="submit" disabled={isLoading || isFetchingData} className="flex-1">
                    {isLoading ? (
                      <><LoadingSpinner size="sm" className="mr-2" /> Salvando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>
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
    </div>
  )
}
