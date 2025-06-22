'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from '@/components/loading-spinner'
import { StatusBadge } // Assuming this can handle Takedown statuses
from '@/components/status-badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Send, Shield, Info, AlertTriangle, Mail } from 'lucide-react'

// Interfaces (adjust based on your actual API response)
interface BrandProfileMin {
  id: string;
  brandName: string;
}

interface TakedownRequest {
  id: string;
  status: string; // e.g., PENDING, SENT, ACKNOWLEDGED, REMOVED, REJECTED
  recipientEmail?: string;
  sentAt?: string;
  createdAt: string;
}

interface DetectedContent {
  id: string;
  title: string;
  infringingUrl: string;
  platform: string;
  detectedAt: string;
  isConfirmed: boolean;
  brandProfile: BrandProfileMin;
  takedownRequest?: TakedownRequest | null;
  // Add any other relevant fields from your API
  monitoringSession?: {
    name: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function DetectedContentClient() {
  const [detectedContents, setDetectedContents] = useState<DetectedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const [isTakedownModalOpen, setIsTakedownModalOpen] = useState(false)
  const [selectedContentForTakedown, setSelectedContentForTakedown] = useState<DetectedContent | null>(null)
  const [takedownFormData, setTakedownFormData] = useState({
    recipientEmail: '',
    customMessage: '',
  })
  const [isSubmittingTakedown, setIsSubmittingTakedown] = useState(false)

  const fetchDetectedContent = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      // TODO: Add userId query parameter if your API requires it
      const response = await fetch(`/api/detected-content?page=${page}&limit=${ITEMS_PER_PAGE}`)
      if (response.ok) {
        const data = await response.json()
        setDetectedContents(data.items || data.detectedContents || []) // Adjust based on API
        setTotalPages(data.totalPages || 1)
        setTotalItems(data.totalItems || 0)
        setCurrentPage(data.currentPage || page)
      } else {
        toast.error('Erro ao carregar conteúdo detectado.')
      }
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error('Erro de conexão ao carregar conteúdo.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDetectedContent(currentPage)
  }, [fetchDetectedContent, currentPage])

  const handleConfirmContent = async (contentId: string) => {
    try {
      const response = await fetch(`/api/detected-content/${contentId}/confirm`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Conteúdo confirmado com sucesso!')
        // Refresh data or update state directly
        setDetectedContents(prevContents =>
          prevContents.map(content =>
            content.id === contentId ? { ...content, isConfirmed: true } : content
          )
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao confirmar conteúdo.')
      }
    } catch (error) {
      toast.error('Erro de conexão ao confirmar conteúdo.')
    }
  }

  const openTakedownModal = (content: DetectedContent) => {
    setSelectedContentForTakedown(content)
    setTakedownFormData({ recipientEmail: '', customMessage: '' }) // Reset form
    setIsTakedownModalOpen(true)
  }

  const handleTakedownSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContentForTakedown) return

    setIsSubmittingTakedown(true)
    try {
      const response = await fetch('/api/takedown-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          detectedContentId: selectedContentForTakedown.id,
          platform: selectedContentForTakedown.platform, // API might infer this from detectedContentId
          recipientEmail: takedownFormData.recipientEmail,
          customMessage: takedownFormData.customMessage || undefined,
          // TODO: Add userId if your API requires it
        }),
      })

      if (response.ok) {
        const newTakedownRequest = await response.json()
        toast.success('Solicitação de takedown enviada com sucesso!')
        setIsTakedownModalOpen(false)
        // Update content item with new takedown request info
        setDetectedContents(prevContents =>
          prevContents.map(content =>
            content.id === selectedContentForTakedown.id
              ? { ...content, takedownRequest: newTakedownRequest }
              : content
          )
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao enviar solicitação de takedown.')
      }
    } catch (error) {
      toast.error('Erro de conexão ao enviar solicitação de takedown.')
    } finally {
      setIsSubmittingTakedown(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (isLoading && detectedContents.length === 0) { // Show full page spinner only on initial load
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isLoading && detectedContents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-16"
      >
        <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Nenhum conteúdo detectado ainda
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Assim que nosso sistema encontrar conteúdo que corresponda às suas sessões de monitoramento, ele aparecerá aqui.
        </p>
        <Link href="/monitoring/new">
          <Button>
             <Search className="h-4 w-4 mr-2"/> Configurar Monitoramento
          </Button>
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-muted-foreground mb-4">
        Total de itens encontrados: {totalItems}. Página {currentPage} de {totalPages}.
      </p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título / Plataforma</TableHead>
              <TableHead>URL Infratora</TableHead>
              <TableHead>Detectado Em</TableHead>
              <TableHead>Perfil de Marca</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && detectedContents.length > 0 && ( // Inline loading for subsequent fetches
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <LoadingSpinner size="md" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && detectedContents.map((content) => (
              <TableRow key={content.id}>
                <TableCell>
                  <div className="font-medium">{content.title}</div>
                  <div className="text-xs text-muted-foreground">{content.platform}</div>
                </TableCell>
                <TableCell>
                  <a
                    href={content.infringingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate max-w-xs block"
                    title={content.infringingUrl}
                  >
                    {content.infringingUrl}
                  </a>
                </TableCell>
                <TableCell>{format(new Date(content.detectedAt), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>
                    <Badge variant="outline" className="flex items-center w-fit">
                        <Shield size={12} className="mr-1 text-muted-foreground"/>
                        {content.brandProfile.brandName}
                    </Badge>
                </TableCell>
                <TableCell>
                  {content.isConfirmed ? (
                    <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white">
                      <CheckCircle size={14} className="mr-1" /> Confirmado
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Info size={14} className="mr-1" /> Não Confirmado
                    </Badge>
                  )}
                  {content.takedownRequest && (
                    <div className="mt-1">
                       <StatusBadge status={content.takedownRequest.status} />
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {!content.isConfirmed && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfirmContent(content.id)}
                    >
                      <CheckCircle size={14} className="mr-1" /> Confirmar
                    </Button>
                  )}
                  {content.isConfirmed && !content.takedownRequest && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openTakedownModal(content)}
                    >
                      <Mail size={14} className="mr-1" /> Iniciar Takedown
                    </Button>
                  )}
                  {content.takedownRequest && (
                     <Button variant="ghost" size="sm" disabled>Ação Registrada</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(pageNumber)}
              disabled={isLoading}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Takedown Modal */}
      {selectedContentForTakedown && (
        <Dialog open={isTakedownModalOpen} onOpenChange={setIsTakedownModalOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Iniciar Solicitação de Takedown</DialogTitle>
              <DialogDescription>
                Para: <span className="font-semibold">{selectedContentForTakedown.platform}</span> - <span className="italic">{selectedContentForTakedown.title}</span>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTakedownSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Email do Destinatário *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="Ex: dmca@platform.com, abuse@host.com"
                    value={takedownFormData.recipientEmail}
                    onChange={(e) => setTakedownFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    required
                    disabled={isSubmittingTakedown}
                  />
                   <p className="text-xs text-muted-foreground">
                    Email para onde a notificação DMCA será enviada.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customMessage">Mensagem Adicional (Opcional)</Label>
                  <Textarea
                    id="customMessage"
                    placeholder="Qualquer informação adicional que você queira incluir na notificação..."
                    value={takedownFormData.customMessage}
                    onChange={(e) => setTakedownFormData(prev => ({ ...prev, customMessage: e.target.value }))}
                    disabled={isSubmittingTakedown}
                    rows={4}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <p><strong>ID do Conteúdo:</strong> {selectedContentForTakedown.id}</p>
                  <p><strong>URL Infratora:</strong> {selectedContentForTakedown.infringingUrl}</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmittingTakedown}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingTakedown}>
                  {isSubmittingTakedown ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" /> Enviando...
                    </>
                  ) : (
                    <>
                     <Send size={14} className="mr-2"/> Enviar Solicitação
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}
'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Search } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from '@/components/loading-spinner'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Send, Shield, Info, AlertTriangle, Mail } from 'lucide-react'

// --- INTERFACES CORRIGIDAS ---
interface BrandProfileMin {
  id: string;
  brandName: string; // Corrigido de name para brandName
}

interface TakedownRequest {
  id: string;
  isConfirmed: boolean;
  recipientEmail?: string;
  sentAt?: string;
  createdAt: string;
  status: string; // Adicionado para refletir o status da TakedownRequest
}

interface DetectedContent {
  id: string;
  title: string;
  url: string;             // Corrigido de infringingUrl
  platform: string;
  createdAt: string;       // Corrigido de detectedAt
  isConfirmed: boolean;          // Corrigido de isConfirmed
  brandProfile: BrandProfileMin;
  takedownRequest?: TakedownRequest | null;
  monitoringSession?: {
    name: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function DetectedContentClient() {
  const [detectedContents, setDetectedContents] = useState<DetectedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const [isTakedownModalOpen, setIsTakedownModalOpen] = useState(false)
  const [selectedContentForTakedown, setSelectedContentForTakedown] = useState<DetectedContent | null>(null)
  const [takedownFormData, setTakedownFormData] = useState({
    recipientEmail: '',
    customMessage: '',
  })
  const [isSubmittingTakedown, setIsSubmittingTakedown] = useState(false)

  // --- FUNÇÃO DE BUSCA CORRIGIDA ---
  const fetchDetectedContent = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/detected-content?page=${page}&limit=${ITEMS_PER_PAGE}`)
      if (response.ok) {
        const apiResponse = await response.json();
        setDetectedContents(apiResponse.data || [])
        setTotalPages(apiResponse.pagination.pages || 1)
        setTotalItems(apiResponse.pagination.total || 0)
        setCurrentPage(apiResponse.pagination.page || page)
      } else {
        toast.error('Erro ao carregar conteúdo detectado.')
      }
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error('Erro de conexão ao carregar conteúdo.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDetectedContent(currentPage)
  }, [fetchDetectedContent, currentPage])

  const handleConfirmContent = async (contentId: string) => {
    try {
      const response = await fetch(`/api/detected-content/${contentId}/confirm`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('Conteúdo confirmado com sucesso!')
        fetchDetectedContent(currentPage); // Re-fetch data to show updated status
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao confirmar conteúdo.')
      }
    } catch (error) {
      toast.error('Erro de conexão ao confirmar conteúdo.')
    }
  }

  const openTakedownModal = (content: DetectedContent) => {
    setSelectedContentForTakedown(content)
    setTakedownFormData({ recipientEmail: '', customMessage: '' })
    setIsTakedownModalOpen(true)
  }

const handleTakedownSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!selectedContentForTakedown) {
    toast.error('Nenhum conteúdo selecionado para takedown.');
    return;
  }

  console.log("--- DIAGNÓSTICO: Função handleTakedownSubmit iniciada ---");
  console.log("ID do conteúdo selecionado:", selectedContentForTakedown.id);

  setIsSubmittingTakedown(true);

  try {
    const requestBody = {
      detectedContentId: selectedContentForTakedown.id,
      platform: selectedContentForTakedown.platform,
      recipientEmail: takedownFormData.recipientEmail,
      customMessage: takedownFormData.customMessage,
    };
    console.log("Corpo da requisição:", requestBody);

    const response = await fetch('/api/takedown-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Erro ao decodificar resposta" }));
      throw new Error(errorData.error || `Falha na API: ${response.status}`);
    }

    const newTakedownRequest = await response.json();
    toast.success('Solicitação criada com sucesso!');
    setIsTakedownModalOpen(false);
    fetchDetectedContent(currentPage);
  } catch (error) {
    console.error("--- DIAGNÓSTICO: ERRO ---", error);
    toast.error(error instanceof Error ? error.message : 'Erro desconhecido.');
  } finally {
    setIsSubmittingTakedown(false);
  }
};

const handlePageChange = (page: number) => {
  console.log("Mudar para página:", page);
};

  if (isLoading && detectedContents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isLoading && detectedContents.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-16"
      >
        <AlertTriangle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Nenhum conteúdo detectado ainda
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Assim que nosso sistema encontrar conteúdo que corresponda às suas sessões de monitoramento, ele aparecerá aqui.
        </p>
        <Link href="/monitoring/new" legacyBehavior>
          <a>
            <Button>
              <Search className="h-4 w-4 mr-2"/> Configurar Monitoramento
            </Button>
          </a>
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-muted-foreground mb-4">
        Total de itens encontrados: {totalItems}. Página {currentPage} de {totalPages}.
      </p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título / Plataforma</TableHead>
              <TableHead>URL Infratora</TableHead>
              <TableHead>Detectado Em</TableHead>
              <TableHead>Perfil de Marca</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* --- TABELA E LÓGICA DE EXIBIÇÃO CORRIGIDAS --- */}
            {detectedContents.map((content) => (
              <TableRow key={content.id}>
                <TableCell>
                  <div className="font-medium">{content.title}</div>
                  <div className="text-xs text-muted-foreground">{content.platform}</div>
                </TableCell>
                <TableCell>
                  <a
                    href={content.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate max-w-xs block"
                    title={content.url}
                  >
                    {content.url}
                  </a>
                </TableCell>
                <TableCell>{format(new Date(content.createdAt), "dd/MM/yyyy HH:mm")}</TableCell>
                <TableCell>
                    <Badge variant="outline" className="flex items-center w-fit">
                        <Shield size={12} className="mr-1 text-muted-foreground"/>
                        {content.brandProfile.brandName}
                    </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={
                      content.takedownRequest
                        ? content.takedownRequest.status
                        : content.isConfirmed
                          ? 'CONFIRMED'
                          : 'PENDING_REVIEW'
                    }
                  />
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {content.isConfirmed === false && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfirmContent(content.id)}
                    >
                      <CheckCircle size={14} className="mr-1" /> Confirmar
                    </Button>
                  )}
                  {content.isConfirmed === true && !content.takedownRequest && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openTakedownModal(content)}
                    >
                      <Mail size={14} className="mr-1" /> Iniciar Takedown
                    </Button>
                  )}
                  {content.takedownRequest && (
                      <Button variant="ghost" size="sm" disabled>Ação Registrada</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
          >
            Anterior
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
            <Button
              key={pageNumber}
              variant={currentPage === pageNumber ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(pageNumber)}
              disabled={isLoading}
            >
              {pageNumber}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
          >
            Próxima
          </Button>
        </div>
      )}

      {/* Takedown Modal */}
      {selectedContentForTakedown && (
        <Dialog open={isTakedownModalOpen} onOpenChange={setIsTakedownModalOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Iniciar Solicitação de Takedown</DialogTitle>
              <DialogDescription>
                Para: <span className="font-semibold">{selectedContentForTakedown.platform}</span> - <span className="italic">{selectedContentForTakedown.title}</span>
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTakedownSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientEmail">Email do Destinatário *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    placeholder="Ex: dmca@platform.com, abuse@host.com"
                    value={takedownFormData.recipientEmail}
                    onChange={(e) => setTakedownFormData(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    required
                    disabled={isSubmittingTakedown}
                  />
                    <p className="text-xs text-muted-foreground">
                    Email para onde a notificação DMCA será enviada.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customMessage">Mensagem Adicional (Opcional)</Label>
                  <Textarea
                    id="customMessage"
                    placeholder="Qualquer informação adicional que você queira incluir na notificação..."
                    value={takedownFormData.customMessage}
                    onChange={(e) => setTakedownFormData(prev => ({ ...prev, customMessage: e.target.value }))}
                    disabled={isSubmittingTakedown}
                    rows={4}
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  <p><strong>ID do Conteúdo:</strong> {selectedContentForTakedown.id}</p>
                  <p><strong>URL Infratora:</strong> {selectedContentForTakedown.url}</p>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isSubmittingTakedown}>
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSubmittingTakedown}>
                  {isSubmittingTakedown ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send size={14} className="mr-2"/> Enviar Solicitação
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}