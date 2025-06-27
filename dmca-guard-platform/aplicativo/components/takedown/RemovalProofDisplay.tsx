'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  Download,
  Camera,
  Globe,
  Shield,
  RefreshCw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface RemovalProof {
  id: string
  url: string
  status: RemovalStatus
  proofType: ProofType
  verificationDate: Date
  screenshotPath?: string
  httpStatusCode?: number
  responseBody?: string
  errorMessage?: string
  retryCount: number
  metadata: RemovalMetadata
}

interface RemovalMetadata {
  originalDetectedAt: Date
  dmcaSentAt: Date
  firstVerificationAt: Date
  lastVerificationAt: Date
  verificationHistory: VerificationAttempt[]
  automatedChecks: number
  manualReviews: number
  confidenceLevel: number
}

interface VerificationAttempt {
  timestamp: Date
  status: RemovalStatus
  method: 'AUTOMATED' | 'MANUAL'
  evidence: string[]
  confidence: number
  notes?: string
}

type RemovalStatus = 
  | 'PENDING_VERIFICATION'
  | 'CONTENT_STILL_ONLINE'
  | 'CONTENT_REMOVED'
  | 'SITE_UNREACHABLE'
  | 'CONTENT_BLOCKED'
  | 'URL_REDIRECTED'
  | 'VERIFICATION_FAILED'
  | 'REQUIRES_MANUAL_REVIEW'

type ProofType = 
  | 'HTTP_404_NOT_FOUND'
  | 'HTTP_410_GONE'
  | 'HTTP_403_FORBIDDEN'
  | 'CONTENT_REMOVED_MESSAGE'
  | 'DMCA_TAKEDOWN_NOTICE'
  | 'SITE_OFFLINE'
  | 'MANUAL_VERIFICATION'
  | 'SCREENSHOT_EVIDENCE'

interface RemovalProofDisplayProps {
  takedownRequestId: string
  url: string
  onRefresh?: () => void
}

export function RemovalProofDisplay({ 
  takedownRequestId, 
  url, 
  onRefresh 
}: RemovalProofDisplayProps) {
  const [proofs, setProofs] = useState<RemovalProof[]>([])
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [selectedProof, setSelectedProof] = useState<RemovalProof | null>(null)

  useEffect(() => {
    loadVerificationHistory()
  }, [url])

  const loadVerificationHistory = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/takedown/verify-removal?url=${encodeURIComponent(url)}`)
      const data = await response.json()

      if (data.success) {
        setProofs(data.data.verificationHistory)
        if (data.data.verificationHistory.length > 0) {
          setSelectedProof(data.data.verificationHistory[0])
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de verificações:', error)
    } finally {
      setLoading(false)
    }
  }

  const initiateVerification = async () => {
    try {
      setVerifying(true)
      const response = await fetch('/api/takedown/verify-removal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ takedownRequestId })
      })

      const data = await response.json()

      if (data.success) {
        // Aguardar alguns segundos e recarregar
        setTimeout(() => {
          loadVerificationHistory()
          onRefresh?.()
        }, 3000)
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('Erro ao iniciar verificação:', error)
      alert('Erro ao iniciar verificação: ' + (error as Error).message)
    } finally {
      setVerifying(false)
    }
  }

  const getStatusIcon = (status: RemovalStatus) => {
    switch (status) {
      case 'CONTENT_REMOVED':
      case 'CONTENT_BLOCKED':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'CONTENT_STILL_ONLINE':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'PENDING_VERIFICATION':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'SITE_UNREACHABLE':
        return <Globe className="h-4 w-4 text-gray-500" />
      case 'VERIFICATION_FAILED':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      default:
        return <Eye className="h-4 w-4 text-blue-500" />
    }
  }

  const getStatusBadge = (status: RemovalStatus) => {
    const statusConfig = {
      'CONTENT_REMOVED': { variant: 'default' as const, label: 'Removido' },
      'CONTENT_BLOCKED': { variant: 'default' as const, label: 'Bloqueado' },
      'CONTENT_STILL_ONLINE': { variant: 'destructive' as const, label: 'Ainda Online' },
      'PENDING_VERIFICATION': { variant: 'secondary' as const, label: 'Aguardando' },
      'SITE_UNREACHABLE': { variant: 'outline' as const, label: 'Site Inacessível' },
      'VERIFICATION_FAILED': { variant: 'destructive' as const, label: 'Falha na Verificação' },
      'REQUIRES_MANUAL_REVIEW': { variant: 'secondary' as const, label: 'Revisão Manual' },
      'URL_REDIRECTED': { variant: 'secondary' as const, label: 'URL Redirecionada' }
    }

    const config = statusConfig[status] || { variant: 'outline' as const, label: status }
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    )
  }

  const getProofTypeLabel = (proofType: ProofType) => {
    const labels = {
      'HTTP_404_NOT_FOUND': 'HTTP 404 - Não Encontrado',
      'HTTP_410_GONE': 'HTTP 410 - Removido',
      'HTTP_403_FORBIDDEN': 'HTTP 403 - Bloqueado',
      'CONTENT_REMOVED_MESSAGE': 'Mensagem de Remoção',
      'DMCA_TAKEDOWN_NOTICE': 'Aviso DMCA',
      'SITE_OFFLINE': 'Site Offline',
      'MANUAL_VERIFICATION': 'Verificação Manual',
      'SCREENSHOT_EVIDENCE': 'Evidência por Screenshot'
    }
    return labels[proofType] || proofType
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600'
    if (confidence >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Carregando verificações...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho com botão de verificação */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verificação de Remoção
          </CardTitle>
          <Button 
            onClick={initiateVerification}
            disabled={verifying}
            size="sm"
          >
            {verifying ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Verificando...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Verificar Agora
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            URL: <span className="font-mono">{url}</span>
          </div>
          {proofs.length > 0 && (
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">Status Atual:</span>
                {getStatusBadge(proofs[0].status)}
                <span className={`text-sm font-medium ${getConfidenceColor(proofs[0].metadata.confidenceLevel)}`}>
                  {proofs[0].metadata.confidenceLevel}% confiança
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico de verificações */}
      {proofs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Verificações</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="timeline" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="evidence">Evidências</TabsTrigger>
              </TabsList>
              
              <TabsContent value="timeline" className="space-y-4">
                <div className="space-y-3">
                  {proofs.map((proof, index) => (
                    <div 
                      key={proof.id}
                      className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedProof?.id === proof.id ? 'bg-accent' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedProof(proof)}
                    >
                      <div className="flex-shrink-0">
                        {getStatusIcon(proof.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(proof.status)}
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(proof.verificationDate), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {getProofTypeLabel(proof.proofType)}
                          {proof.httpStatusCode && (
                            <span className="ml-2">• HTTP {proof.httpStatusCode}</span>
                          )}
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${getConfidenceColor(proof.metadata.confidenceLevel)}`}>
                        {proof.metadata.confidenceLevel}%
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="details">
                {selectedProof && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Informações Gerais</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Status:</span> {getStatusBadge(selectedProof.status)}
                          </div>
                          <div>
                            <span className="font-medium">Tipo de Prova:</span> {getProofTypeLabel(selectedProof.proofType)}
                          </div>
                          <div>
                            <span className="font-medium">Verificado em:</span> {' '}
                            {new Date(selectedProof.verificationDate).toLocaleString('pt-BR')}
                          </div>
                          <div>
                            <span className="font-medium">Tentativas:</span> {selectedProof.retryCount + 1}
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Métricas</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Confiança:</span>
                            <span className={`ml-2 font-medium ${getConfidenceColor(selectedProof.metadata.confidenceLevel)}`}>
                              {selectedProof.metadata.confidenceLevel}%
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Verificações Automáticas:</span> {selectedProof.metadata.automatedChecks}
                          </div>
                          <div>
                            <span className="font-medium">Revisões Manuais:</span> {selectedProof.metadata.manualReviews}
                          </div>
                          {selectedProof.httpStatusCode && (
                            <div>
                              <span className="font-medium">Código HTTP:</span> {selectedProof.httpStatusCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedProof.errorMessage && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded">
                        <h4 className="font-medium text-red-800 mb-1">Erro</h4>
                        <p className="text-sm text-red-700">{selectedProof.errorMessage}</p>
                      </div>
                    )}

                    {selectedProof.responseBody && (
                      <div className="p-3 bg-gray-50 border rounded">
                        <h4 className="font-medium mb-1">Resposta do Servidor</h4>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                          {selectedProof.responseBody}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="evidence">
                {selectedProof && (
                  <div className="space-y-4">
                    {selectedProof.screenshotPath && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Camera className="h-4 w-4" />
                            Screenshot de Evidência
                          </h4>
                          <Button size="sm" variant="outline">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                        <div className="bg-gray-100 rounded p-4">
                          <p className="text-sm text-muted-foreground">
                            Screenshot capturado em: {new Date(selectedProof.verificationDate).toLocaleString('pt-BR')}
                          </p>
                          <p className="text-sm font-mono mt-1">
                            {selectedProof.screenshotPath}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <h4 className="font-medium">Evidências Coletadas</h4>
                      {selectedProof.metadata.verificationHistory
                        .filter(attempt => attempt.evidence.length > 0)
                        .map((attempt, index) => (
                          <div key={index} className="p-3 border rounded">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">{attempt.method}</Badge>
                              <span className="text-sm text-muted-foreground">
                                {new Date(attempt.timestamp).toLocaleString('pt-BR')}
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {attempt.evidence.map((evidence, evidenceIndex) => (
                                <li key={evidenceIndex} className="text-sm text-gray-700">
                                  • {evidence}
                                </li>
                              ))}
                            </ul>
                            {attempt.notes && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Notas:</strong> {attempt.notes}
                              </p>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {proofs.length === 0 && !loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma verificação encontrada</h3>
            <p className="text-muted-foreground mb-4">
              Ainda não foram realizadas verificações de remoção para esta URL.
            </p>
            <Button onClick={initiateVerification} disabled={verifying}>
              {verifying ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Verificando...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Iniciar Verificação
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
