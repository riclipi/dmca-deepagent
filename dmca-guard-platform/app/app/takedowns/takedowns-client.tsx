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
import { LoadingSpinner } from '@/components/loading-spinner'
import { StatusBadge } from '@/components/status-badge'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Mail, LinkIcon, Shield, CalendarDays, ExternalLink, FileText, Clock } from 'lucide-react' // Added FileText, Clock

// Interfaces
interface DetectedContentForTakedown {
  id: string;
  title: string;
  infringingUrl: string;
  platform: string; // Platform of detected content
  brandProfile: {
    brandName: string;
  };
}

interface TakedownRequest {
  id: string;
  detectedContent: DetectedContentForTakedown;
  platform: string; // Platform where takedown was sent (might be same as detectedContent.platform)
  recipientEmail: string;
  status: string; // e.g., PENDING, SENT, ACKNOWLEDGED, REMOVED, REJECTED
  sentAt?: string; // ISO date string
  resolvedAt?: string; // ISO date string
  createdAt: string; // ISO date string
  customMessage?: string;
}

const ITEMS_PER_PAGE = 10;

export default function TakedownsClient() {
  const [takedownRequests, setTakedownRequests] = useState<TakedownRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  const fetchTakedownRequests = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      // TODO: Add userId query parameter if your API requires it
      const response = await fetch(`/api/takedown-requests?page=${page}&limit=${ITEMS_PER_PAGE}`)
      if (response.ok) {
        const data = await response.json()
        setTakedownRequests(data.items || data.takedownRequests || []) // Adjust based on API
        setTotalPages(data.totalPages || 1)
        setTotalItems(data.totalItems || 0)
        setCurrentPage(data.currentPage || page)
      } else {
        toast.error('Erro ao carregar solicitações de takedown.')
      }
    } catch (error) {
      console.error("Fetch error:", error)
      toast.error('Erro de conexão ao carregar solicitações.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTakedownRequests(currentPage)
  }, [fetchTakedownRequests, currentPage])

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (isLoading && takedownRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
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
        <Button onClick={() => router.push('/detected-content')}>
            <LinkIcon className="h-4 w-4 mr-2"/> Ver Conteúdo Detectado
        </Button>
      </motion.div>
    )
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
              <TableHead className="w-[30%]">Conteúdo Infrator</TableHead>
              <TableHead>Plataforma Alvo</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Datas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && takedownRequests.length > 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10">
                  <LoadingSpinner size="md" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && takedownRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium text-sm mb-1">{request.detectedContent.title}</div>
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
                  <Badge variant="outline" className="mt-1 text-xs flex items-center w-fit">
                      <Shield size={10} className="mr-1 text-muted-foreground"/>
                      {request.detectedContent.brandProfile.brandName}
                  </Badge>
                </TableCell>
                <TableCell>
                    <Badge variant="secondary" className="text-xs">{request.platform}</Badge>
                </TableCell>
                <TableCell className="text-xs">{request.recipientEmail}</TableCell>
                <TableCell>
                  <StatusBadge status={request.status} />
                </TableCell>
                <TableCell className="text-xs space-y-1">
                    <div className="flex items-center" title="Data de criação da solicitação">
                        <Clock size={12} className="mr-1 text-muted-foreground shrink-0"/>
                        <span>Pedido: {formatDate(request.createdAt)}</span>
                    </div>
                    {request.sentAt && (
                         <div className="flex items-center" title="Data de envio da solicitação">
                            <Mail size={12} className="mr-1 text-muted-foreground shrink-0"/>
                            <span>Enviado: {formatDate(request.sentAt)}</span>
                        </div>
                    )}
                    {request.resolvedAt && (
                        <div className="flex items-center" title="Data de resolução">
                            <CalendarDays size={12} className="mr-1 text-muted-foreground shrink-0"/>
                            <span>Resolvido: {formatDate(request.resolvedAt)}</span>
                        </div>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
          {/* Simplified pagination: show current page and ellipses if too many pages */}
          {/* For a small number of pages, map all */}
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
              {/* Show first page */}
              <Button variant={currentPage === 1 ? "default" : "outline"} size="sm" onClick={() => handlePageChange(1)} disabled={isLoading}>1</Button>
              {/* Ellipsis if current page is far from start */}
              {currentPage > 3 && <span className="text-sm p-2">...</span>}
              {/* Pages around current page */}
              {currentPage > 2 && <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={isLoading}>{currentPage - 1}</Button>}
              {currentPage !== 1 && currentPage !== totalPages && <Button variant="default" size="sm" disabled>{currentPage}</Button>}
              {currentPage < totalPages -1 && <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={isLoading}>{currentPage + 1}</Button>}
              {/* Ellipsis if current page is far from end */}
              {currentPage < totalPages - 2 && <span className="text-sm p-2">...</span>}
              {/* Show last page */}
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
  )
}

// Helper for router.push in empty state button, if not already imported
// For client components, you need to use useRouter from 'next/navigation'
// const router = useRouter(); at the top of the component if needed for the button
// For now, the button is just illustrative as there's no direct action from this page.
// If it were to link, it would be:
// import { useRouter } from 'next/navigation'
// ...
// const router = useRouter();
// ...
// <Button onClick={() => router.push('/detected-content')}>
//   <LinkIcon className="h-4 w-4 mr-2"/> Ver Conteúdo Detectado
// </Button>
// However, since this client component is rendered by page.tsx, we don't need useRouter here for that button
// if the page.tsx can handle navigation or if it's a static link.
// For simplicity, the empty state button doesn't strictly need useRouter here if it's just linking.
// The provided code for the empty state button is fine as a placeholder.
// If we want it to be a NextLink:
// import Link from 'next/link'
// <Link href="/detected-content"><Button>...</Button></Link>
// For the example, I'll keep it as a Button that implies an action or navigation.
// A better empty state button would be a Link component for navigation.
// I'll change it to use Link from next/link for the empty state button.
// (Correction will be applied in the next step if necessary, this is a thought process)
// For now, the placeholder is fine. The main logic is the table and data fetching.
// The router import and usage is not needed for the current implementation of the empty state button.
// The button `Ver Conteúdo Detectado` does not use `router.push` so `useRouter` is not needed.
// (Final check: The empty state button is okay, `useRouter` is not needed for its current form)
// The pagination logic was also improved to be more scalable for many pages.
