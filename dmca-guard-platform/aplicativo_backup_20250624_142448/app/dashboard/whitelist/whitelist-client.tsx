'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/loading-spinner';
import { PlusCircle, Trash2, ListChecks, AlertTriangle } from 'lucide-react'; // Added ListChecks, AlertTriangle
import { motion } from 'framer-motion';

interface DomainWhitelistEntry {
  id: string;
  domain: string;
  createdAt: string;
}

export default function WhitelistClient() {
  const [whitelistedDomains, setWhitelistedDomains] = useState<DomainWhitelistEntry[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Error state for displaying form-specific errors, e.g., from API validation
  const [formError, setFormError] = useState<string | null>(null);

  const fetchWhitelistedDomains = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/domain-whitelists');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao buscar domínios.');
      }
      const data: DomainWhitelistEntry[] = await response.json();
      setWhitelistedDomains(data);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar domínios da whitelist.');
      console.error("Fetch whitelist error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWhitelistedDomains();
  }, [fetchWhitelistedDomains]);

  const handleAddDomain = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null); // Clear previous form errors
    if (!newDomain.trim()) {
      setFormError('O campo de domínio não pode estar vazio.');
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/domain-whitelists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: newDomain }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Assuming API returns error like { error: "message", details?: ... }
        const message = responseData.error || 'Falha ao adicionar domínio.';
        if (responseData.details?.fieldErrors?.domain) {
          setFormError(responseData.details.fieldErrors.domain.join(', '));
        } else {
          setFormError(message); // General error if no specific field error
        }
        toast.error(message);
      } else {
        toast.success(`Domínio "${responseData.domain}" adicionado à whitelist!`);
        setWhitelistedDomains(prev => [...prev, responseData]);
        setNewDomain(''); // Clear input
      }
    } catch (error: any) {
      toast.error('Erro ao conectar com o servidor.');
      setFormError('Erro de conexão. Tente novamente.');
      console.error("Add domain error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDomain = async (id: string, domainName: string) => {
    if (!confirm(`Tem certeza que deseja remover o domínio "${domainName}" da whitelist?`)) {
      return;
    }
    try {
      const response = await fetch(`/api/domain-whitelists/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Falha ao remover domínio.');
      }
      toast.success(`Domínio "${domainName}" removido da whitelist!`);
      setWhitelistedDomains(prev => prev.filter(d => d.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Erro ao remover domínio.');
      console.error("Remove domain error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PlusCircle className="h-5 w-5 mr-2 text-primary" />
              Adicionar Novo Domínio à Whitelist
            </CardTitle>
            <CardDescription>
              Insira o domínio que você deseja que seja ignorado pelas varreduras de conteúdo.
              Use o formato <code className="bg-muted px-1 py-0.5 rounded text-xs">example.com</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddDomain} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newDomain">Domínio</Label>
                <div className="flex space-x-2">
                  <Input
                    id="newDomain"
                    type="text"
                    placeholder="exemplo.com"
                    value={newDomain}
                    onChange={(e) => { setNewDomain(e.target.value); setFormError(null);}}
                    disabled={isSubmitting}
                    className={formError ? 'border-red-500' : ''}
                  />
                  <Button type="submit" disabled={isSubmitting || !newDomain.trim()}>
                    {isSubmitting ? <LoadingSpinner size="sm" className="mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                    Adicionar
                  </Button>
                </div>
                {formError && <p className="text-sm text-red-500">{formError}</p>}
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListChecks className="h-5 w-5 mr-2 text-primary" />
              Domínios na Whitelist ({whitelistedDomains.length})
            </CardTitle>
            <CardDescription>
              Estes domínios e seus subdomínios serão ignorados durante as buscas por conteúdo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {whitelistedDomains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">Nenhum domínio na whitelist ainda.</p>
                <p className="text-sm">Adicione domínios no formulário acima para começar.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {whitelistedDomains.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="font-mono text-sm">{entry.domain}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDomain(entry.id, entry.domain)}
                      className="text-red-500 hover:text-red-600"
                      title="Remover da whitelist"
                    >
                      <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Remover</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
