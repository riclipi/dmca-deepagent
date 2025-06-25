'use client'

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Search } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from '@/components/loading-spinner';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  CheckCircle, XCircle, Send, Shield, Info, AlertTriangle, Mail, MoreHorizontal,
  Edit, Trash2, Check, X, Users, Archive, ChevronDown
} from 'lucide-react';
import { AutoDmcaWidget } from '@/components/dmca/auto-dmca-widget';

// Interfaces
interface BrandProfileMin {
  id: string;
  brandName: string;
}

interface TakedownRequest {
  id: string;
  status: string;
  recipientEmail?: string;
  sentAt?: string;
  createdAt: string;
}

interface DetectedContent {
  id: string;
  title: string;
  url: string;
  platform: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  createdAt: string;
  isConfirmed: boolean;
  description?: string;
  notes?: string;
  brandProfile: BrandProfileMin;
  takedownRequest?: TakedownRequest | null;
  monitoringSession?: {
    name: string;
  };
}

const ITEMS_PER_PAGE = 10;

export default function DetectedContentClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [detectedContents, setDetectedContents] = useState<DetectedContent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Selection states
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)

  // Edit modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingContent, setEditingContent] = useState<DetectedContent | null>(null)
  const [editFormData, setEditFormData] = useState({
    priority: 'MEDIUM' as const,
    description: '',
    notes: '',
    isConfirmed: false
  })
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)

  // Delete confirmation states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [contentToDelete, setContentToDelete] = useState<DetectedContent | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Batch operations states
  const [isBatchActionsVisible, setIsBatchActionsVisible] = useState(false)
  const [isProcessingBatch, setIsProcessingBatch] = useState(false)

  const [isTakedownModalOpen, setIsTakedownModalOpen] = useState(false)
  const [selectedContentForTakedown, setSelectedContentForTakedown] = useState<DetectedContent | null>(null)
  const [takedownFormData, setTakedownFormData] = useState({
    recipientEmail: '',
    customMessage: '',
  })
  const [isSubmittingTakedown, setIsSubmittingTakedown] = useState(false)

  // Auto-DMCA modal states
  const [isAutoDmcaModalOpen, setIsAutoDmcaModalOpen] = useState(false)
  const [selectedContentForAutoDmca, setSelectedContentForAutoDmca] = useState<DetectedContent | null>(null)

  // Watch selected items to show/hide batch actions
  useEffect(() => {
    setIsBatchActionsVisible(selectedItems.size > 0)
  }, [selectedItems])

  // Initialize page from URL params
  useEffect(() => {
    const pageFromUrl = parseInt(searchParams.get('page') || '1')
    if (pageFromUrl !== currentPage) {
      setCurrentPage(pageFromUrl)
    }
  }, [searchParams])

  const fetchDetectedContent = useCallback(async (page: number = 1, signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/detected-content?page=${page}&limit=${ITEMS_PER_PAGE}`, { signal })
      if (response.ok) {
        const apiResponse = await response.json()
        if (!signal?.aborted) {
          setDetectedContents(apiResponse.data || [])
          setTotalPages(apiResponse.pagination.pages || 1)
          setTotalItems(apiResponse.pagination.total || 0)
          setCurrentPage(apiResponse.pagination.page || page)
        }
      } else {
        if (!signal?.aborted) {
          toast.error('Erro ao carregar conteúdo detectado.')
        }
      }
    } catch (error) {
      if (!signal?.aborted) {
        console.error("Fetch error:", error)
        toast.error('Erro de conexão ao carregar conteúdo.')
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    fetchDetectedContent(currentPage, abortController.signal)
    
    return () => {
      abortController.abort()
    }
  }, [fetchDetectedContent, currentPage])

  // Selection functions
  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
    
    // Update select all state
    setSelectAll(newSelected.size === detectedContents.length && detectedContents.length > 0)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(detectedContents.map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
    setSelectAll(checked)
  }

  // Edit functions
  const openEditModal = (content: DetectedContent) => {
    setEditingContent(content)
    setEditFormData({
      priority: content.priority,
      description: content.description || '',
      notes: content.notes || '',
      isConfirmed: content.isConfirmed
    })
    setIsEditModalOpen(true)
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingContent) return

    setIsSubmittingEdit(true)
    try {
      const response = await fetch(`/api/detected-content/${editingContent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao atualizar conteúdo')
      }

      toast.success('Conteúdo atualizado com sucesso!')
      setIsEditModalOpen(false)
      fetchDetectedContent(currentPage)
    } catch (error) {
      console.error('Erro ao editar:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar conteúdo')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  // Delete functions
  const openDeleteDialog = (content: DetectedContent) => {
    setContentToDelete(content)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!contentToDelete) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/detected-content/${contentToDelete.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao deletar conteúdo')
      }

      toast.success('Conteúdo deletado com sucesso!')
      setIsDeleteDialogOpen(false)
      setContentToDelete(null)
      fetchDetectedContent(currentPage)
    } catch (error) {
      console.error('Erro ao deletar:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao deletar conteúdo')
    } finally {
      setIsDeleting(false)
    }
  }

  // Batch operations
  const handleBatchOperation = async (action: string, priority?: string) => {
    if (selectedItems.size === 0) {
      toast.error('Nenhum item selecionado')
      return
    }

    setIsProcessingBatch(true)
    try {
      const requestBody: any = {
        action,
        ids: Array.from(selectedItems)
      }
      
      if (priority) {
        requestBody.priority = priority
      }

      const response = await fetch('/api/detected-content/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro na operação em lote')
      }

      const result = await response.json()
      toast.success(result.message || `${result.processed} itens processados com sucesso`)
      
      // Clear selection and refresh
      setSelectedItems(new Set())
      setSelectAll(false)
      fetchDetectedContent(currentPage)
    } catch (error) {
      console.error('Erro em operação batch:', error)
      toast.error(error instanceof Error ? error.message : 'Erro na operação em lote')
    } finally {
      setIsProcessingBatch(false)
    }
  }

  const handleConfirmContent = async (contentId: string) => {
    const abortController = new AbortController()
    try {
      const response = await fetch(`/api/detected-content/${contentId}/confirm`, {
        method: 'POST',
        signal: abortController.signal
      })
      if (response.ok) {
        toast.success('Conteúdo confirmado com sucesso!')
        fetchDetectedContent(currentPage, abortController.signal)
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Erro ao confirmar conteúdo.')
      }
    } catch (error) {
      if (!abortController.signal.aborted) {
        toast.error('Erro de conexão ao confirmar conteúdo.')
      }
    }
  }

  const openTakedownModal = (content: DetectedContent) => {
    setSelectedContentForTakedown(content)
    setTakedownFormData({ recipientEmail: '', customMessage: '' })
    setIsTakedownModalOpen(true)
  }

  const openAutoDmcaModal = (content: DetectedContent) => {
    setSelectedContentForAutoDmca(content)
    setIsAutoDmcaModalOpen(true)
  }

  const handleTakedownSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedContentForTakedown) {
      toast.error('Nenhum conteúdo selecionado para takedown.');
      return;
    }

    setIsSubmittingTakedown(true);

    try {
      const requestBody = {
        detectedContentId: selectedContentForTakedown.id,
        platform: selectedContentForTakedown.platform,
        recipientEmail: takedownFormData.recipientEmail,
        customMessage: takedownFormData.customMessage,
      };

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
      toast.success('Takedown criado e enviado por email com sucesso!');
      setIsTakedownModalOpen(false);
      fetchDetectedContent(currentPage);
    } catch (error) {
      console.error("Erro:", error);
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido.');
    } finally {
      setIsSubmittingTakedown(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages && page !== currentPage && !isLoading) {
      // Update URL with new page parameter
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', page.toString())
      router.push(`?${params.toString()}`)
      setCurrentPage(page);
    }
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
      <div className="flex justify-between items-center mb-4">
        <p className="text-muted-foreground">
          Total de itens encontrados: {totalItems}. Página {currentPage} de {totalPages}.
        </p>
        
        {/* Batch Actions Bar */}
        {isBatchActionsVisible && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3"
          >
            <span className="text-sm font-medium text-blue-700">
              {selectedItems.size} item(s) selecionado(s)
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchOperation('APPROVE_FOR_TAKEDOWN')}
                disabled={isProcessingBatch}
              >
                <Check className="h-4 w-4 mr-1" />
                Aprovar para Takedown
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBatchOperation('MARK_AS_IGNORED')}
                disabled={isProcessingBatch}
              >
                <X className="h-4 w-4 mr-1" />
                Marcar como Ignorado
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" disabled={isProcessingBatch}>
                    Definir Prioridade <ChevronDown className="h-4 w-4 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleBatchOperation('SET_PRIORITY', 'URGENT')}>
                    🔴 Urgente
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchOperation('SET_PRIORITY', 'HIGH')}>
                    🟠 Alta
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchOperation('SET_PRIORITY', 'MEDIUM')}>
                    🟡 Média
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleBatchOperation('SET_PRIORITY', 'LOW')}>
                    🟢 Baixa
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBatchOperation('DELETE')}
                disabled={isProcessingBatch}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Deletar
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  disabled={detectedContents.length === 0}
                />
              </TableHead>
              <TableHead>Título / Plataforma</TableHead>
              <TableHead>URL Infratora</TableHead>
              <TableHead>Detectado Em</TableHead>
              <TableHead>Perfil de Marca</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {detectedContents.map((content) => (
              <TableRow key={content.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedItems.has(content.id)}
                    onCheckedChange={(checked) => handleSelectItem(content.id, checked as boolean)}
                  />
                </TableCell>
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
                <TableCell>
                  <Badge 
                    variant={
                      content.priority === 'URGENT' ? 'destructive' :
                      content.priority === 'HIGH' ? 'destructive' :
                      content.priority === 'MEDIUM' ? 'secondary' :
                      'outline'
                    }
                  >
                    {content.priority}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
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
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => openAutoDmcaModal(content)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Mail size={14} className="mr-1" /> Auto-DMCA
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openTakedownModal(content)}
                        >
                          <Mail size={14} className="mr-1" /> Manual
                        </Button>
                      </>
                    )}
                    {content.takedownRequest && (
                      <Button variant="ghost" size="sm" disabled>
                        Ação Registrada
                      </Button>
                    )}
                    
                    {/* Actions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(content)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(content)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Conteúdo Detectado</DialogTitle>
            <DialogDescription>
              Atualize as informações do conteúdo detectado
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select 
                  value={editFormData.priority} 
                  onValueChange={(value: any) => setEditFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">🟢 Baixa</SelectItem>
                    <SelectItem value="MEDIUM">🟡 Média</SelectItem>
                    <SelectItem value="HIGH">🟠 Alta</SelectItem>
                    <SelectItem value="URGENT">🔴 Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descrição do conteúdo..."
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  disabled={isSubmittingEdit}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas internas sobre este conteúdo..."
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, notes: e.target.value }))}
                  disabled={isSubmittingEdit}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isConfirmed"
                  checked={editFormData.isConfirmed}
                  onCheckedChange={(checked) => setEditFormData(prev => ({ ...prev, isConfirmed: checked as boolean }))}
                  disabled={isSubmittingEdit}
                />
                <Label htmlFor="isConfirmed">Conteúdo confirmado</Label>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmittingEdit}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmittingEdit}>
                {isSubmittingEdit ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" /> Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" /> Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o conteúdo "{contentToDelete?.title}"? 
              Esta ação não pode ser desfeita.
              {contentToDelete?.takedownRequest && (
                <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
                  ⚠️ Este conteúdo possui takedown requests associados e não pode ser deletado.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting || !!contentToDelete?.takedownRequest}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" /> Deletando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" /> Deletar
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Auto-DMCA Modal */}
      {isAutoDmcaModalOpen && selectedContentForAutoDmca && (
        <Dialog open={isAutoDmcaModalOpen} onOpenChange={setIsAutoDmcaModalOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>🤖 Auto-DMCA Submission</DialogTitle>
              <DialogDescription>
                Automated DMCA takedown request with contact detection
              </DialogDescription>
            </DialogHeader>
            
            <AutoDmcaWidget
              detectedContentId={selectedContentForAutoDmca.id}
              contentUrl={selectedContentForAutoDmca.url}
              platform={selectedContentForAutoDmca.platform}
              priority={selectedContentForAutoDmca.priority}
              onSubmitSuccess={() => {
                setIsAutoDmcaModalOpen(false)
                fetchDetectedContent(currentPage)
                toast.success('Auto-DMCA request submitted successfully!')
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </motion.div>
  )
}