'use client'

import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Upload, 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

interface UploadResult {
  success: boolean
  summary: {
    totalProcessed: number
    totalImported: number
    duplicates: number
    errors: number
  }
  details: {
    errors: string[]
    hasMoreErrors: boolean
  }
}

interface PreviewData {
  url: string
  category?: string
  platform?: string
  violationCount?: number
  riskScore?: number
  lastSeen?: string
  isValid: boolean
  errors: string[]
}

interface UploadOptions {
  overwrite: boolean
  skipDuplicates: boolean
  validateUrls: boolean
  maxRows: number
}

export function KnownSitesUploader() {
  const [uploadMode, setUploadMode] = useState<'csv' | 'json'>('csv')
  const [files, setFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [previewData, setPreviewData] = useState<PreviewData[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [options, setOptions] = useState<UploadOptions>({
    overwrite: false,
    skipDuplicates: true,
    validateUrls: true,
    maxRows: 1000
  })

  // Configuração do dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    // Validar tipo de arquivo
    const isCSV = file.name.toLowerCase().endsWith('.csv')
    const isJSON = file.name.toLowerCase().endsWith('.json')

    if (!isCSV && !isJSON) {
      toast.error('Apenas arquivos CSV e JSON são suportados')
      return
    }

    setFiles([file])
    setUploadMode(isCSV ? 'csv' : 'json')
    setResult(null)

    // Gerar preview automaticamente
    if (file.size < 1024 * 1024) { // Apenas para arquivos < 1MB
      await generatePreview(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  })

  // Gerar preview dos dados
  const generatePreview = async (file: File) => {
    try {
      const text = await file.text()
      let preview: PreviewData[] = []

      if (file.name.toLowerCase().endsWith('.csv')) {
        preview = parseCSVPreview(text)
      } else if (file.name.toLowerCase().endsWith('.json')) {
        preview = parseJSONPreview(text)
      }

      setPreviewData(preview.slice(0, 10)) // Apenas primeiros 10 itens
      setShowPreview(true)
    } catch (error) {
      toast.error('Erro ao gerar preview do arquivo')
      console.error('Preview error:', error)
    }
  }

  // Parse CSV para preview
  const parseCSVPreview = (text: string): PreviewData[] => {
    const lines = text.split('\n').filter(line => line.trim())
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const dataLines = lines.slice(1, 11) // Primeiras 10 linhas

    return dataLines.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/['"]/g, ''))
      const data: any = {}
      const errors: string[] = []

      headers.forEach((header, index) => {
        const value = values[index]
        switch (header) {
          case 'url':
            data.url = value
            if (!value || !isValidUrl(value)) {
              errors.push('URL inválida')
            }
            break
          case 'category':
            data.category = value
            break
          case 'platform':
            data.platform = value
            break
          case 'violation_count':
            data.violationCount = value ? parseInt(value) : 0
            break
          case 'risk_score':
            data.riskScore = value ? parseInt(value) : 50
            if (data.riskScore < 0 || data.riskScore > 100) {
              errors.push('Risk score deve estar entre 0-100')
            }
            break
          case 'last_seen':
            data.lastSeen = value
            break
        }
      })

      return {
        ...data,
        isValid: errors.length === 0 && data.url,
        errors
      }
    })
  }

  // Parse JSON para preview
  const parseJSONPreview = (text: string): PreviewData[] => {
    try {
      const parsed = JSON.parse(text)
      const sites = parsed.sites || parsed

      if (!Array.isArray(sites)) {
        return []
      }

      return sites.slice(0, 10).map(site => {
        const errors: string[] = []

        if (!site.url || !isValidUrl(site.url)) {
          errors.push('URL inválida')
        }

        if (site.riskScore && (site.riskScore < 0 || site.riskScore > 100)) {
          errors.push('Risk score deve estar entre 0-100')
        }

        return {
          url: site.url || '',
          category: site.category,
          platform: site.platform,
          violationCount: site.violationCount || 0,
          riskScore: site.riskScore || 50,
          lastSeen: site.lastSeen,
          isValid: errors.length === 0 && site.url,
          errors
        }
      })
    } catch (error) {
      return []
    }
  }

  // Validar URL
  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`)
      return true
    } catch {
      return false
    }
  }

  // Executar upload
  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Selecione um arquivo primeiro')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', files[0])
      formData.append('options', JSON.stringify(options))

      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/known-sites/import', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      const result = await response.json()

      if (response.ok) {
        setResult(result)
        toast.success(`Importação concluída! ${result.summary.totalImported} sites importados.`)
      } else {
        throw new Error(result.error || 'Erro na importação')
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Erro na importação')
    } finally {
      setIsUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

  // Baixar template
  const downloadTemplate = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/known-sites/import/template?format=${format}`)
      if (!response.ok) throw new Error('Erro ao baixar template')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `known-sites-template.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success(`Template ${format.toUpperCase()} baixado!`)
    } catch (error) {
      toast.error('Erro ao baixar template')
    }
  }

  // Limpar arquivos
  const clearFiles = () => {
    setFiles([])
    setPreviewData([])
    setShowPreview(false)
    setResult(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Sites Conhecidos
          </CardTitle>
          <CardDescription>
            Faça upload de uma lista de sites conhecidos via CSV ou JSON para começar o monitoramento automático.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload">Upload de Arquivo</TabsTrigger>
              <TabsTrigger value="options">Opções</TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-4">
              {/* Área de Drop */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium mb-2">
                  {isDragActive ? 'Solte o arquivo aqui' : 'Arraste um arquivo ou clique para selecionar'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Suporta arquivos CSV e JSON (máximo 5MB)
                </p>
              </div>

              {/* Arquivo selecionado */}
              {files.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{files[0].name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(files[0].size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearFiles}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Botões de ação */}
              <div className="flex gap-3">
                <Button 
                  onClick={handleUpload} 
                  disabled={files.length === 0 || isUploading}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Sites
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('csv')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template CSV
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => downloadTemplate('json')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Template JSON
                </Button>
              </div>

              {/* Barra de progresso */}
              {isUploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    Processando arquivo... {uploadProgress}%
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="options" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRows">Máximo de linhas</Label>
                  <Input
                    id="maxRows"
                    type="number"
                    min="1"
                    max="10000"
                    value={options.maxRows}
                    onChange={(e) => setOptions(prev => ({ 
                      ...prev, 
                      maxRows: parseInt(e.target.value) || 1000 
                    }))}
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="overwrite"
                      checked={options.overwrite}
                      onCheckedChange={(checked) => setOptions(prev => ({ 
                        ...prev, 
                        overwrite: checked as boolean 
                      }))}
                    />
                    <Label htmlFor="overwrite">Sobrescrever sites existentes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="skipDuplicates"
                      checked={options.skipDuplicates}
                      onCheckedChange={(checked) => setOptions(prev => ({ 
                        ...prev, 
                        skipDuplicates: checked as boolean 
                      }))}
                    />
                    <Label htmlFor="skipDuplicates">Pular duplicatas</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="validateUrls"
                      checked={options.validateUrls}
                      onCheckedChange={(checked) => setOptions(prev => ({ 
                        ...prev, 
                        validateUrls: checked as boolean 
                      }))}
                    />
                    <Label htmlFor="validateUrls">Validar URLs</Label>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview dos dados */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Preview dos Dados
            </CardTitle>
            <CardDescription>
              Primeiros {previewData.length} itens do arquivo (mostrando apenas para validação)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {previewData.map((item, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-lg border ${
                    item.isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="font-medium">{item.url || 'URL não informada'}</p>
                      <div className="flex gap-2 text-sm">
                        {item.category && (
                          <Badge variant="secondary">{item.category}</Badge>
                        )}
                        {item.platform && (
                          <Badge variant="outline">{item.platform}</Badge>
                        )}
                        {item.riskScore && (
                          <Badge variant="secondary">Risco: {item.riskScore}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.isValid ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </div>
                  {item.errors.length > 0 && (
                    <div className="mt-2 text-sm text-red-600">
                      {item.errors.map((error, i) => (
                        <p key={i}>• {error}</p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da importação */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{result.summary.totalProcessed}</p>
                <p className="text-sm text-muted-foreground">Processados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{result.summary.totalImported}</p>
                <p className="text-sm text-muted-foreground">Importados</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.summary.duplicates}</p>
                <p className="text-sm text-muted-foreground">Duplicatas</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.summary.errors}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.details.errors.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Erros encontrados:</p>
                  <ul className="space-y-1">
                    {result.details.errors.map((error, index) => (
                      <li key={index} className="text-sm">• {error}</li>
                    ))}
                  </ul>
                  {result.details.hasMoreErrors && (
                    <p className="text-sm text-muted-foreground mt-2">
                      ... e mais erros. Verifique o arquivo e tente novamente.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}