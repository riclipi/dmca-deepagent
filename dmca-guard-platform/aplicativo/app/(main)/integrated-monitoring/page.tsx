'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Search, 
  Plus, 
  CheckCircle, 
  AlertCircle,
  LoaderIcon,
  Sparkles,
  Target,
  Clock
} from 'lucide-react'
import { toast } from 'sonner'

const platformOptions = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Twitter/X',
  'Facebook',
  'Telegram',
  'WhatsApp',
  'OnlyFans',
  'Outros'
]

export default function IntegratedMonitoringPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [createdResult, setCreatedResult] = useState<any>(null)
  
  // Form data
  const [brandName, setBrandName] = useState('')
  const [description, setDescription] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [scanFrequency, setScanFrequency] = useState(24)
  const [generateKeywords, setGenerateKeywords] = useState(true)
  const [customKeywords, setCustomKeywords] = useState('')
  const [excludeKeywords, setExcludeKeywords] = useState('')
  const [officialUrls, setOfficialUrls] = useState('')

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const payload = {
        brandName,
        description: description || undefined,
        sessionName,
        sessionDescription: sessionDescription || undefined,
        targetPlatforms: selectedPlatforms,
        scanFrequency,
        generateKeywords,
        customKeywords: customKeywords.split(',').map(k => k.trim()).filter(k => k),
        excludeKeywords: excludeKeywords.split(',').map(k => k.trim()).filter(k => k),
        officialUrls: officialUrls.split(',').map(u => u.trim()).filter(u => u)
      }

      const response = await fetch('/api/integrated-monitoring', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (response.ok) {
        setCreatedResult(data)
        toast.success(data.message)
        
        // Reset form
        setBrandName('')
        setDescription('')
        setSessionName('')
        setSessionDescription('')
        setSelectedPlatforms([])
        setScanFrequency(24)
        setCustomKeywords('')
        setExcludeKeywords('')
        setOfficialUrls('')
      } else {
        toast.error(data.error || 'Erro ao criar monitoramento')
      }
    } catch (error) {
      console.error('Erro:', error)
      toast.error('Erro ao criar monitoramento')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-generate session name based on brand name
  const handleBrandNameChange = (value: string) => {
    setBrandName(value)
    if (value && !sessionName) {
      setSessionName(`${value} - Monitoramento Principal`)
    }
  }

  if (createdResult) {
    return (
      <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Monitoramento Criado com Sucesso! 🎉
          </h1>
          <p className="text-muted-foreground">
            Seu brand profile e sessão de monitoramento estão prontos para uso
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2 h-5 w-5 text-blue-500" />
                Brand Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {createdResult.brandProfile.brandName}</p>
                <p><strong>ID:</strong> <code className="text-xs bg-gray-100 px-1 rounded">{createdResult.brandProfile.id}</code></p>
                <Badge variant="outline" className="text-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Ativo
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Search className="mr-2 h-5 w-5 text-purple-500" />
                Sessão de Monitoramento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>Nome:</strong> {createdResult.monitoringSession.name}</p>
                <p><strong>Plataformas:</strong> {createdResult.monitoringSession.targetPlatforms.join(', ')}</p>
                <p><strong>Keywords:</strong> {createdResult.monitoringSession.totalKeywords}</p>
                <Badge variant="outline" className="text-blue-600">
                  <Clock className="mr-1 h-3 w-3" />
                  {createdResult.monitoringSession.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {createdResult.keywords.generated && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-yellow-500" />
                Keywords Geradas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">{createdResult.keywords.safeCount}</div>
                  <div className="text-sm text-muted-foreground">Seguras</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{createdResult.keywords.moderateCount}</div>
                  <div className="text-sm text-muted-foreground">Moderadas</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{createdResult.keywords.dangerousCount}</div>
                  <div className="text-sm text-muted-foreground">Bloqueadas</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-center space-x-4">
          <Button onClick={() => setCreatedResult(null)}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Outro
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/monitoring'}>
            <Target className="mr-2 h-4 w-4" />
            Ver Monitoramentos
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Criar Monitoramento Integrado
        </h1>
        <p className="text-muted-foreground">
          Crie um brand profile e sessão de monitoramento em uma única etapa
        </p>
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Brand Profile Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="mr-2 h-5 w-5 text-blue-500" />
              Informações da Marca
            </CardTitle>
            <CardDescription>
              Dados básicos do seu brand profile
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brandName">Nome da Marca *</Label>
              <Input
                id="brandName"
                value={brandName}
                onChange={(e) => handleBrandNameChange(e.target.value)}
                placeholder="Ex: Lary Cubas"
                required
              />
            </div>
            
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva sua marca..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="officialUrls">URLs Oficiais (opcional)</Label>
              <Input
                id="officialUrls"
                value={officialUrls}
                onChange={(e) => setOfficialUrls(e.target.value)}
                placeholder="https://site1.com, https://site2.com"
              />
              <p className="text-xs text-muted-foreground mt-1">Separe múltiplas URLs com vírgula</p>
            </div>
          </CardContent>
        </Card>

        {/* Monitoring Session Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="mr-2 h-5 w-5 text-purple-500" />
              Configurações de Monitoramento
            </CardTitle>
            <CardDescription>
              Configure como será feito o monitoramento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="sessionName">Nome da Sessão *</Label>
              <Input
                id="sessionName"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Ex: Lary Cubas - Monitoramento Principal"
                required
              />
            </div>

            <div>
              <Label htmlFor="sessionDescription">Descrição da Sessão (opcional)</Label>
              <Textarea
                id="sessionDescription"
                value={sessionDescription}
                onChange={(e) => setSessionDescription(e.target.value)}
                placeholder="Descreva o objetivo desta sessão..."
                rows={2}
              />
            </div>

            <div>
              <Label>Plataformas a Monitorar *</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {platformOptions.map((platform) => (
                  <div key={platform} className="flex items-center space-x-2">
                    <Checkbox
                      id={platform}
                      checked={selectedPlatforms.includes(platform)}
                      onCheckedChange={() => handlePlatformToggle(platform)}
                    />
                    <Label htmlFor={platform} className="text-sm">{platform}</Label>
                  </div>
                ))}
              </div>
              {selectedPlatforms.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Selecione pelo menos uma plataforma</p>
              )}
            </div>

            <div>
              <Label htmlFor="scanFrequency">Frequência de Scan (horas) *</Label>
              <Input
                id="scanFrequency"
                type="number"
                min="1"
                value={scanFrequency}
                onChange={(e) => setScanFrequency(parseInt(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Intervalo entre verificações (mínimo 1 hora)</p>
            </div>
          </CardContent>
        </Card>

        {/* Keywords Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Sparkles className="mr-2 h-5 w-5 text-yellow-500" />
              Keywords
            </CardTitle>
            <CardDescription>
              Configure as palavras-chave para busca
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="generateKeywords"
                checked={generateKeywords}
                onCheckedChange={(checked) => setGenerateKeywords(!!checked)}
              />
              <Label htmlFor="generateKeywords">Gerar keywords automaticamente a partir do nome da marca</Label>
            </div>
            {generateKeywords && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm text-blue-700">
                  ✨ O sistema irá gerar automaticamente variações seguras do nome da marca, 
                  como separadores, leetspeak leve, e outras variações comuns.
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="customKeywords">Keywords Adicionais (opcional)</Label>
              <Input
                id="customKeywords"
                value={customKeywords}
                onChange={(e) => setCustomKeywords(e.target.value)}
                placeholder="keyword1, keyword2, keyword3"
              />
              <p className="text-xs text-muted-foreground mt-1">Separe com vírgula</p>
            </div>

            <div>
              <Label htmlFor="excludeKeywords">Keywords a Excluir (opcional)</Label>
              <Input
                id="excludeKeywords"
                value={excludeKeywords}
                onChange={(e) => setExcludeKeywords(e.target.value)}
                placeholder="palavra1, palavra2"
              />
              <p className="text-xs text-muted-foreground mt-1">Keywords que devem ser ignoradas</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button 
            type="submit" 
            disabled={isLoading || selectedPlatforms.length === 0}
            className="min-w-[200px]"
          >
            {isLoading ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Criar Monitoramento
              </>
            )}
          </Button>
        </div>
      </form>
    </main>
  )
}
