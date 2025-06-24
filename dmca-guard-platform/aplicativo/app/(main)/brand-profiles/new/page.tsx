'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Footer } from '@/components/footer'
import { LoadingSpinner } from '@/components/loading-spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Shield, Plus, X, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { generateNameVariants } from '@/lib/name-generator'

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

  // URLs com prefixo "https://" visual
  const handleUrlChange = (index: number, value: string) => {
    const clean = value.replace(/^https?:\/\//, '')
    setFormData(prev => ({
      ...prev,
      officialUrls: prev.officialUrls.map((item, i) => i === index ? clean : item)
    }))
  }
  const addUrl = () => setFormData(prev => ({ ...prev, officialUrls: [...prev.officialUrls, ''] }))
  const removeUrl = (idx: number) => setFormData(prev => ({
    ...prev,
    officialUrls: prev.officialUrls.filter((_, i) => i !== idx)
  }))

  // Palavras-chave
  const handleKeywordChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.map((item, i) => i === index ? value : item)
    }))
  }
  const addKeyword = () => setFormData(prev => ({ ...prev, keywords: [...prev.keywords, ''] }))
  const removeKeyword = (idx: number) => setFormData(prev => ({
    ...prev,
    keywords: prev.keywords.filter((_, i) => i !== idx)
  }))

  // Gera todas as variações de todas as palavras-chave preenchidas
  const userKeywords = formData.keywords.map(k => k.trim()).filter(k => k !== '')
  const allKeywordVariants = Array.from(
    new Set(userKeywords.flatMap(k => generateNameVariants(k)))
  ).filter(v => !userKeywords.includes(v)) // Mostra só as variações "novas"

  // Redes sociais — sempre com https:// no início
  const handleSocialMediaChange = (platform: string, value: string) => {
    // Remove https:// do começo para o usuário digitar só o restante
    const clean = value.replace(/^https?:\/\//, '')
    setFormData(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: clean
      }
    }))
  }

  // Função para retornar o valor para mostrar/input (mostra só o valor limpo, mas salva sempre com https://)
  const getSocialMediaInputValue = (platform: string) => formData.socialMedia[platform as keyof typeof formData.socialMedia]

  // Função para salvar rede social sempre com prefixo correto
  const socialMediaWithHttps = Object.fromEntries(
    Object.entries(formData.socialMedia)
      .filter(([_, value]) => value.trim() !== '')
      .map(([key, value]) => [
        key,
        value.startsWith('https://') ? value : `https://${value}`
      ])
  )

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    // URLs: prefixo + remove vazios
    const filteredUrls = formData.officialUrls
      .map(url => url.trim())
      .filter(url => url !== '')
      .map(url => url.startsWith('https://') ? url : `https://${url}`)

    // Palavras-chave digitadas
    const filteredKeywords = userKeywords
    // Variações por IA
    const iaVariants = allKeywordVariants
    // Todas as keywords finais (digitadas + variações por IA)
    const finalKeywords = Array.from(new Set([...filteredKeywords, ...iaVariants]))

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
    if (finalKeywords.length === 0) {
      toast.error('Pelo menos uma palavra-chave é obrigatória')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/brand-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: formData.brandName.trim(),
          description: formData.description.trim() || undefined,
          officialUrls: filteredUrls,
          socialMedia: socialMediaWithHttps,
          keywords: finalKeywords
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
    <>
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
                    onChange={e => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
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
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                    <div key={index} className="flex items-center mb-2">
                      <span className="px-2 py-1 bg-muted rounded-l text-muted-foreground border border-r-0 border-input text-xs select-none">
                        https://
                      </span>
                      <Input
                        className="rounded-r w-full"
                        placeholder="exemplo.com/meu-perfil"
                        value={url}
                        onChange={e => handleUrlChange(index, e.target.value)}
                        disabled={isLoading}
                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                      />
                      {formData.officialUrls.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeUrl(index)}
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
                    onClick={addUrl}
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
                    {['instagram', 'twitter', 'onlyfans', 'other'].map((platform) => (
                      <div key={platform} className="space-y-2">
                        <Label htmlFor={platform}>{platform === 'other' ? 'Outro' : platform.charAt(0).toUpperCase() + platform.slice(1).replace('onlyfans','OnlyFans').replace('twitter','Twitter/X')}</Label>
                        <div className="flex items-center">
                          <span className="px-2 py-1 bg-muted rounded-l text-muted-foreground border border-r-0 border-input text-xs select-none">
                            https://
                          </span>
                          <Input
                            id={platform}
                            placeholder={platform === 'other' ? 'Outro link relevante' : `${platform}.com/seuperfil`}
                            value={getSocialMediaInputValue(platform)}
                            onChange={e => handleSocialMediaChange(platform, e.target.value)}
                            disabled={isLoading}
                            className="rounded-r w-full"
                            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Palavras-chave */}
                <div className="space-y-2">
                  <Label>Palavras-chave *</Label>
                  <p className="text-sm text-muted-foreground">
                    Termos que identificam seu conteúdo (nome artístico, apelidos, etc.)
                  </p>
                  {formData.keywords.map((keyword, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <Input
                        placeholder="Ex: meu nome artístico"
                        value={keyword}
                        onChange={e => handleKeywordChange(index, e.target.value)}
                        disabled={isLoading}
                      />
                      {formData.keywords.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeKeyword(index)}
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
                    onClick={addKeyword}
                    disabled={isLoading}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Palavra-chave
                  </Button>
                </div>

                {/* Container: Variações por IA */}
                {allKeywordVariants.length > 0 && (
                  <div className="mt-6 border border-primary/30 rounded-xl bg-primary/5 p-4">
                    <div className="mb-2 font-semibold text-primary">
                      Variações criadas por IA <span aria-label="sparkles" role="img">✨</span>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Essas variações serão monitoradas automaticamente!
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {allKeywordVariants.map((variant, i) => (
                        <span key={i} className="bg-accent text-foreground px-2 py-1 rounded text-xs border border-accent-foreground/20">
                          {variant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

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
    </>
  )
}
