'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/components/ui/use-toast'
import { CheckCircle2, XCircle, AlertCircle, Shield, Copy, RefreshCw } from 'lucide-react'

interface OwnershipInstructions {
  dns?: {
    record: string
    type: string
    value: string
    status: string
    expiresAt?: string
  }
  metaTag?: {
    tag: string
    status: string
    expiresAt?: string
  }
  status: Record<string, string>
}

interface Props {
  brandProfileId: string
}

export function OwnershipValidationStatus({ brandProfileId }: Props) {
  const [loading, setLoading] = useState(true)
  const [validating, setValidating] = useState(false)
  const [instructions, setInstructions] = useState<OwnershipInstructions | null>(null)
  const [brandName, setBrandName] = useState('')

  useEffect(() => {
    fetchValidationStatus()
  }, [brandProfileId])

  const fetchValidationStatus = async () => {
    try {
      const response = await fetch(`/api/brand-profiles/${brandProfileId}/ownership`)
      if (!response.ok) throw new Error('Failed to fetch validation status')

      const data = await response.json()
      setInstructions(data.instructions)
      setBrandName(data.brandProfile.name)
    } catch (error) {
      console.error('Error fetching validation status:', error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o status de validação',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const attemptValidation = async () => {
    setValidating(true)
    try {
      const response = await fetch(`/api/brand-profiles/${brandProfileId}/ownership`, {
        method: 'POST'
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Sucesso!',
          description: 'Propriedade validada com sucesso'
        })
        fetchValidationStatus()
      } else {
        toast({
          title: 'Validação falhou',
          description: data.error || 'Não foi possível validar a propriedade',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error validating ownership:', error)
      toast({
        title: 'Erro',
        description: 'Erro ao tentar validar propriedade',
        variant: 'destructive'
      })
    } finally {
      setValidating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado!',
      description: 'Texto copiado para a área de transferência'
    })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />
      case 'PENDING':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <Shield className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="default">Verificado</Badge>
      case 'FAILED':
        return <Badge variant="destructive">Falhou</Badge>
      case 'PENDING':
        return <Badge variant="secondary">Pendente</Badge>
      case 'MANUAL_REVIEW_REQUIRED':
        return <Badge variant="secondary">Revisão Manual</Badge>
      default:
        return <Badge variant="outline">Não verificado</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  const hasVerification = instructions && Object.keys(instructions.status).length > 0
  const isFullyVerified = instructions && Object.values(instructions.status).every(s => s === 'VERIFIED')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Validação de Propriedade
        </CardTitle>
        <CardDescription>
          Verifique a propriedade da marca {brandName} para habilitar todas as funcionalidades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isFullyVerified ? (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Propriedade Verificada!</AlertTitle>
            <AlertDescription>
              A propriedade da marca foi verificada com sucesso. Todas as funcionalidades estão habilitadas.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* DNS Verification */}
            {instructions?.dns && (
              <div className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    {getStatusIcon(instructions.dns.status)}
                    Verificação DNS
                  </h4>
                  {getStatusBadge(instructions.dns.status)}
                </div>
                
                {instructions.dns.status !== 'VERIFIED' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Adicione o seguinte registro TXT ao seu DNS:
                    </p>
                    <div className="bg-muted p-2 rounded font-mono text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span>Nome: {instructions.dns.record}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(instructions.dns!.record)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Tipo: {instructions.dns.type}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Valor: {instructions.dns.value}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(instructions.dns!.value)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {instructions.dns.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Token expira em: {new Date(instructions.dns.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Meta Tag Verification */}
            {instructions?.metaTag && (
              <div className="space-y-2 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    {getStatusIcon(instructions.metaTag.status)}
                    Verificação Meta Tag
                  </h4>
                  {getStatusBadge(instructions.metaTag.status)}
                </div>
                
                {instructions.metaTag.status !== 'VERIFIED' && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Adicione a seguinte meta tag ao HTML do seu site:
                    </p>
                    <div className="bg-muted p-2 rounded">
                      <code className="text-xs break-all">{instructions.metaTag.tag}</code>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2"
                        onClick={() => copyToClipboard(instructions.metaTag!.tag)}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copiar
                      </Button>
                    </div>
                    {instructions.metaTag.expiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Token expira em: {new Date(instructions.metaTag.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Validation Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={attemptValidation}
                disabled={validating}
              >
                {validating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  'Verificar Propriedade'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={fetchValidationStatus}
              >
                Atualizar Status
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}