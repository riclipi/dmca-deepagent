
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Shield, Plus, X, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function NewBrandProfilePage() {
  const [formData, setFormData] = useState({
    brandName: '',
    description: '',
    officialUrls: [''],
    socialMedia: {
      instagram: '',
      twitter: '',
      onlyfans: '',
      other: ''
    },
    keywords: ['']
  })
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSocialMediaChange = (platform: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value
      }
    }))
  }

  const handleArrayChange = (field: 'officialUrls' | 'keywords', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }))
  }

  const addArrayItem = (field: 'officialUrls' | 'keywords') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }))
  }

  const removeArrayItem = (field: 'officialUrls' | 'keywords', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Filtrar URLs e keywords vazias
    const filteredUrls = formData.officialUrls.filter(url => url.trim() !== '')
    const filteredKeywords = formData.keywords.filter(keyword => keyword.trim() !== '')

    // Validações
    if (!formData.brandName.trim()) {
      toast.error('Nome da marca é obrigatório')
      setIsLoading(false)
      return
    }

    if (filteredUrls.length === 0) {
      toast.error('Pelo menos uma URL oficial é obrigatória')
      setIsLoading(false)
      return
    }

    if (filteredKeywords.length === 0) {
      toast.error('Pelo menos uma palavra-chave é obrigatória')
      setIsLoading(false)
      return
    }

    // Validar URLs
    for (const url of filteredUrls) {
      try {
        new URL(url)
      } catch {
        toast.error(`URL inválida: ${url}`)
        setIsLoading(false)
        return
      }
    }

    try {
      const response = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brandName: formData.brandName.trim(),
          description: formData.description.trim() || undefined,
          officialUrls: filteredUrls,
          socialMedia: Object.fromEntries(
            Object.entries(formData.socialMedia).filter(([_, value]) => value.trim() !== '')
          ),
          keywords: filteredKeywords
        })
      })

      if (response.ok) {
        toast.success('Perfil de marca criado com sucesso!')
        router.push('/brand-profiles')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Erro ao criar perfil de marca')
      }
    } catch (error) {
      toast.error('Erro ao criar perfil de marca')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Link href="/brand-profiles" className="inline-flex items-center text-primary hover:underline mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Perfis de Marca
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Novo Perfil de Marca
          </h1>
          <p className="text-muted-foreground">
            Crie um perfil para monitorar e proteger sua marca digital
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle>Informações da Marca</CardTitle>
              </div>
              <CardDescription>
                Forneça as informações básicas sobre sua marca ou identidade digital
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Nome da Marca */}
                <div className="space-y-2">
                  <Label htmlFor="brandName">Nome da Marca *</Label>
                  <Input
                    id="brandName"
                    placeholder="Ex: Minha Marca Digital"
                    value={formData.brandName}
                    onChange={(e) => handleChange('brandName', e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    placeholder="Descreva brevemente sua marca ou tipo de conteúdo..."
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    disabled={isLoading}
                    rows={3}
                  />
                </div>

                {/* URLs Oficiais */}
                <div className="space-y-2">
                  <Label>URLs Oficiais *</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicione as URLs onde seu conteúdo original está hospedado
                  </p>
                  {formData.officialUrls.map((url, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="https://exemplo.com/meu-perfil"
                        value={url}
                        onChange={(e) => handleArrayChange('officialUrls', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.officialUrls.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeArrayItem('officialUrls', index)}
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
                    onClick={() => addArrayItem('officialUrls')}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar URL
                  </Button>
                </div>

                {/* Redes Sociais */}
                <div className="space-y-4">
                  <Label>Redes Sociais</Label>
                  <p className="text-sm text-muted-foreground">
                    Links para suas redes sociais oficiais (opcional)
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        placeholder="https://instagram.com/seuperfil"
                        value={formData.socialMedia.instagram}
                        onChange={(e) => handleSocialMediaChange('instagram', e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitter">Twitter/X</Label>
                      <Input
                        id="twitter"
                        placeholder="https://twitter.com/seuperfil"
                        value={formData.socialMedia.twitter}
                        onChange={(e) => handleSocialMediaChange('twitter', e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="onlyfans">OnlyFans</Label>
                      <Input
                        id="onlyfans"
                        placeholder="https://onlyfans.com/seuperfil"
                        value={formData.socialMedia.onlyfans}
                        onChange={(e) => handleSocialMediaChange('onlyfans', e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="other">Outro</Label>
                      <Input
                        id="other"
                        placeholder="Outro link relevante"
                        value={formData.socialMedia.other}
                        onChange={(e) => handleSocialMediaChange('other', e.target.value)}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>

                {/* Palavras-chave */}
                <div className="space-y-2">
                  <Label>Palavras-chave *</Label>
                  <p className="text-sm text-muted-foreground">
                    Termos que identificam seu conteúdo (nome artístico, apelidos, etc.)
                  </p>
                  {formData.keywords.map((keyword, index) => (
                    <div key={index} className="flex space-x-2">
                      <Input
                        placeholder="Ex: meu nome artístico"
                        value={keyword}
                        onChange={(e) => handleArrayChange('keywords', index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.keywords.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeArrayItem('keywords', index)}
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
                    onClick={() => addArrayItem('keywords')}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Palavra-chave
                  </Button>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6">
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Criando...
                      </>
                    ) : (
                      'Criar Perfil de Marca'
                    )}
                  </Button>
                  <Link href="/brand-profiles">
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
