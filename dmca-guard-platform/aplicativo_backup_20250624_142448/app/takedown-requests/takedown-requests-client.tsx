'use client'

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link'; // For clickable infringing URL and empty state button
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/loading-spinner';
import { StatusBadge } from '@/components/status-badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, FileText, Edit, Eye, FileEdit, Info, Send // Added Send icon
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


// Interfaces - ensure these match the actual API response structure
interface DetectedContentForTakedown {
  id: string;
  title: string; // This is the keyword
  infringingUrl: string;
  platform: string; // Platform of detected content
}

interface TakedownRequest {
  id: string;
  detectedContent: DetectedContentForTakedown;
  recipientEmail: string;
  status: string;
  subject?: string; // Added subject
  message?: string; // Added message (was customMessage)
  sentAt?: string;
  resolvedAt?: string;
  createdAt: string;
  // customMessage?: string; // Replaced by message
}

const ITEMS_PER_PAGE = 10;

export default function TakedownRequestsClient() {
  const [takedownRequests, setTakedownRequests] = useState<TakedownRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // State for the View/Edit Modal
  const [isViewEditModalOpen, setIsViewEditModalOpen] = useState(false);
  const [selectedTakedownRequest, setSelectedTakedownRequest] = useState<TakedownRequest | null>(null);
  const [editableSubject, setEditableSubject] = useState('');
  const [editableMessage, setEditableMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false); // New state for "Send" button


const fetchTakedownRequests = useCallback(async (page: number = 1) => {
  setIsLoading(true);
  try {
    const response = await fetch(`/api/takedown-requests?page=${page}&limit=${ITEMS_PER_PAGE}`);
    if (response.ok) {
      const data = await response.json();
      setTakedownRequests(data.data || []);
      setTotalPages(data.pagination?.pages || 1);
      setTotalItems(data.pagination?.total || 0);
      setCurrentPage(data.pagination?.page || page);
    } else {
      toast.error('Erro ao carregar solicitações de takedown.');
    }
  } catch (error) {
    console.error("Fetch error:", error);
    toast.error('Erro de conexão ao carregar solicitações.');
  } finally {
    setIsLoading(false);
  }
}, []);


  useEffect(() => {
    fetchTakedownRequests(currentPage);
  }, [fetchTakedownRequests, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    // Format to just date for "Date Created" as per new spec, time can be added if needed
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
  };

  const handleOpenViewEditModal = (request: TakedownRequest) => {
    setSelectedTakedownRequest(request);
    setEditableSubject(request.subject || ''); // subject might be null initially
    setEditableMessage(request.message || ''); // message might be null initially
    setModalError(null);
    setIsViewEditModalOpen(true);
  };

  const handleUpdateTakedownRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTakedownRequest) return;

    // Basic client-side validation
    if (!editableSubject.trim() || editableSubject.length < 5) {
      setModalError('Assunto deve ter pelo menos 5 caracteres.');
      return;
    }
    if (!editableMessage.trim() || editableMessage.length < 20) {
      setModalError('Mensagem deve ter pelo menos 20 caracteres.');
      return;
    }

    setIsUpdating(true);
    setModalError(null);

    try {
      const response = await fetch(`/api/takedown-requests/${selectedTakedownRequest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editableSubject, message: editableMessage }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData.error || 'Falha ao atualizar solicitação.';
        if (responseData.details?.fieldErrors) {
          // Example: concatenate Zod field errors
          const fieldErrors = Object.values(responseData.details.fieldErrors).flat().join(' ');
          setModalError(fieldErrors || errorMsg);
        } else {
          setModalError(errorMsg);
        }
        toast.error(errorMsg);
      } else {
        toast.success('Solicitação de Takedown atualizada com sucesso!');
        setIsViewEditModalOpen(false);
        fetchTakedownRequests(currentPage); // Refresh the list
      }
    } catch (error) {
      console.error("Update takedown error:", error);
      const errorMsg = 'Erro de conexão ao atualizar. Tente novamente.';
      setModalError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendTakedownRequest = async () => {
    if (!selectedTakedownRequest) return;

    if (!confirm(`Tem certeza que deseja marcar esta notificação como enviada para "${selectedTakedownRequest.recipientEmail}"? Esta ação não pode ser desfeita diretamente aqui.`)) {
      return;
    }

    setIsSending(true);
    setModalError(null); // Clear previous errors

    try {
      const response = await fetch(`/api/takedown-requests/${selectedTakedownRequest.id}/send`, {
        method: 'POST',
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = responseData.error || 'Falha ao marcar como enviada.';
        setModalError(errorMsg);
        toast.error(errorMsg);
      } else {
        toast.success('Notificação de Takedown marcada como enviada!');
        setIsViewEditModalOpen(false);
        fetchTakedownRequests(currentPage); // Refresh the list
      }
    } catch (error) {
      console.error("Send takedown error:", error);
      const errorMsg = 'Erro de conexão ao marcar como enviada. Tente novamente.';
      setModalError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsSending(false);
    }
  };


  if (isLoading && takedownRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isLoading && takedownRequests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center py-16"
      >
        <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">
          Nenhuma solicitação de takedown enviada
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Quando você iniciar uma solicitação de remoção para um conteúdo detectado, ela aparecerá aqui.
        </p>
        <Link href="/detected-content">
            <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2"/> Ver Conteúdo Detectado
            </Button>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
      <p className="text-muted-foreground mb-4 text-sm">
        Total de solicitações: {totalItems}. Página {currentPage} de {totalPages}.
      </p>
      <div className="bg-card p-0 rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[35%]">URL Infratora</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Palavra-chave</TableHead>
              <TableHead>Data Criação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && takedownRequests.length > 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10"> {/* Adjusted colSpan */}
                  <LoadingSpinner size="md" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && takedownRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <a
                    href={request.detectedContent.infringingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center"
                    title={request.detectedContent.infringingUrl}
                  >
                    <ExternalLink size={12} className="mr-1 shrink-0"/>
                    <span className="truncate">{request.detectedContent.infringingUrl}</span>
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {request.detectedContent.platform || 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell className="text-xs">
                  {request.detectedContent.title || 'N/A'}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDate(request.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenViewEditModal(request)}
                  >
                    <FileEdit size={16} className="mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Ver / Editar</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* View/Edit Modal */}
      {selectedTakedownRequest && (
        <Dialog open={isViewEditModalOpen} onOpenChange={setIsViewEditModalOpen}>
          <DialogContent className="sm:max-w-2xl"> {/* Larger modal */}
            <form onSubmit={handleUpdateTakedownRequest}>
              <DialogHeader>
                <DialogTitle>Detalhes da Solicitação de Takedown</DialogTitle>
                <DialogDescription>
                  Revise os detalhes e edite o assunto e a mensagem se necessário (apenas para status PENDENTE).
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Non-editable information */}
                <fieldset className="grid grid-cols-3 gap-4 border p-4 rounded-md">
                  <legend className="text-sm font-medium px-1">Informações do Conteúdo Detectado</legend>
                  <div className="col-span-3 sm:col-span-2">
                    <Label htmlFor="modalInfringingUrl" className="text-xs text-muted-foreground">URL Infratora</Label>
                    <a
                        href={selectedTakedownRequest.detectedContent.infringingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-sm text-primary hover:underline truncate"
                        id="modalInfringingUrl"
                    >
                        {selectedTakedownRequest.detectedContent.infringingUrl}
                    </a>
                  </div>
                   <div className="col-span-3 sm:col-span-1">
                    <Label htmlFor="modalPlatform" className="text-xs text-muted-foreground">Plataforma</Label>
                    <p id="modalPlatform" className="mt-1 text-sm font-medium">{selectedTakedownRequest.detectedContent.platform}</p>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Label htmlFor="modalKeyword" className="text-xs text-muted-foreground">Palavra-chave</Label>
                    <p id="modalKeyword" className="mt-1 text-sm">{selectedTakedownRequest.detectedContent.title}</p>
                  </div>
                   <div className="col-span-3 sm:col-span-1">
                    <Label htmlFor="modalStatus" className="text-xs text-muted-foreground">Status Atual</Label>
                     <div className="mt-1">
                        <StatusBadge status={selectedTakedownRequest.status} />
                     </div>
                  </div>
                </fieldset>

                {/* Editable fields */}
                <div className="space-y-2">
                  <Label htmlFor="editableSubject">Assunto do Email</Label>
                  <Input
                    id="editableSubject"
                    value={editableSubject}
                    onChange={(e) => setEditableSubject(e.target.value)}
                    disabled={selectedTakedownRequest.status !== 'PENDING' || isUpdating}
                    className={selectedTakedownRequest.status !== 'PENDING' ? "bg-muted/50" : ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editableMessage">Corpo do Email (Mensagem)</Label>
                  <Textarea
                    id="editableMessage"
                    value={editableMessage}
                    onChange={(e) => setEditableMessage(e.target.value)}
                    rows={10}
                    disabled={selectedTakedownRequest.status !== 'PENDING' || isUpdating}
                    className={selectedTakedownRequest.status !== 'PENDING' ? "bg-muted/50" : ""}
                  />
                </div>
                {modalError && (
                    <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md flex items-center">
                        <Info size={16} className="mr-2" /> {modalError}
                    </p>
                )}
                 {selectedTakedownRequest.status !== 'PENDING' && (
                    <p className="text-sm text-amber-600 bg-amber-500/10 p-3 rounded-md flex items-center">
                        <Info size={16} className="mr-2" /> Esta solicitação não está mais pendente e não pode ser editada.
                    </p>
                )}
              </div>

              <DialogFooter className="mt-6 flex flex-col sm:flex-row sm:justify-between sm:space-x-2">
                <div className="flex-grow space-y-2 sm:space-y-0 sm:space-x-2">
                 {selectedTakedownRequest.status === 'PENDING' && (
                    <Button
                      type="button" // Important: type="button" if not submitting the form
                      onClick={handleSendTakedownRequest}
                      disabled={isSending || isUpdating}
                      variant="default" // Primary action style
                      className="w-full sm:w-auto"
                    >
                      {isSending ? <LoadingSpinner size="sm" className="mr-2" /> : <Send size={16} className="mr-2" />}
                      Marcar como Enviada
                    </Button>
                  )}
                </div>
                <div className="flex space-x-2 justify-end">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={isUpdating || isSending}>
                      Fechar
                    </Button>
                  </DialogClose>
                  {selectedTakedownRequest.status === 'PENDING' && (
                    <Button
                      type="submit" // This button submits the form for updates
                      disabled={isUpdating || isSending}
                      variant="secondary" // Secondary style for update if Send is primary
                      className="w-full sm:w-auto"
                    >
                      {isUpdating ? <LoadingSpinner size="sm" className="mr-2" /> : <FileEdit size={16} className="mr-2" />}
                      Atualizar Texto
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

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
          {totalPages <= 7 ? (
            Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNumber => (
              <Button
                key={pageNumber}
                variant={currentPage === pageNumber ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(pageNumber)}
                disabled={isLoading}
              >
                {pageNumber}
              </Button>
            ))
          ) : (
            <>
              <Button variant={currentPage === 1 ? "default" : "outline"} size="sm" onClick={() => handlePageChange(1)} disabled={isLoading}>1</Button>
              {currentPage > 3 && <span className="text-sm p-2">...</span>}
              {currentPage > 2 && <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={isLoading}>{currentPage - 1}</Button>}
              {currentPage !== 1 && currentPage !== totalPages && <Button variant="default" size="sm" disabled>{currentPage}</Button>}
              {currentPage < totalPages -1 && <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={isLoading}>{currentPage + 1}</Button>}
              {currentPage < totalPages - 2 && <span className="text-sm p-2">...</span>}
              <Button variant={currentPage === totalPages ? "default" : "outline"} size="sm" onClick={() => handlePageChange(totalPages)} disabled={isLoading}>{totalPages}</Button>
            </>
          )}
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
    </motion.div>
  );
}
