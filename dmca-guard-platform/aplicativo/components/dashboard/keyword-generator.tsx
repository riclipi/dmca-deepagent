// components/dashboard/keyword-generator.tsx

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Wand2, 
  CheckCircle, 
  AlertTriangle, 
  X,
  RefreshCw,
  Key,
  Shield,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface BrandProfile {
  id: string;
  brandName: string;
  safeKeywords?: string[];
  moderateKeywords?: string[];
  dangerousKeywords?: string[];
  lastKeywordUpdate?: string;
}

interface KeywordGeneratorProps {
  brandProfiles: BrandProfile[];
  onKeywordsGenerated?: () => void;
}

interface KeywordStats {
  safe: number;
  moderate: number;
  dangerous: number;
  total: number;
}

export default function KeywordGenerator({ 
  brandProfiles, 
  onKeywordsGenerated 
}: KeywordGeneratorProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResults, setLastResults] = useState<{
    profileName: string;
    stats: KeywordStats;
    keywords: { safe: string[]; moderate: string[]; dangerous: string[] };
  } | null>(null);
  
  const { toast } = useToast();

  const generateKeywords = async () => {
    if (!selectedProfile) {
      toast({
        title: "Erro",
        description: "Selecione um perfil de marca",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`/api/brand-profiles/${selectedProfile}/generate-safe-keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      
      if (response.ok) {
        const profile = brandProfiles.find(p => p.id === selectedProfile);
        setLastResults({
          profileName: profile?.brandName || 'Perfil',
          stats: data.statistics,
          keywords: data.keywords
        });
        
        if (onKeywordsGenerated) {
          onKeywordsGenerated();
        }
        
        toast({
          title: "✅ Keywords Geradas!",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Erro na geração');
      }
    } catch (error) {
      console.error('Erro gerando keywords:', error);
      toast({
        title: "❌ Erro na Geração",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getProfileStats = (profile: BrandProfile) => {
    return {
      safe: profile.safeKeywords?.length || 0,
      moderate: profile.moderateKeywords?.length || 0,
      dangerous: profile.dangerousKeywords?.length || 0,
      hasKeywords: (profile.safeKeywords?.length || 0) > 0,
      lastUpdate: profile.lastKeywordUpdate
    };
  };

  return (
    <div className="space-y-6">
      {/* Gerador de Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wand2 className="h-5 w-5 mr-2 text-purple-500" />
            Gerador de Keywords Seguras
          </CardTitle>
          <CardDescription>
            Gere automaticamente keywords seguras e filtradas para busca de vazamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seleção de Perfil */}
          <div>
            <label className="text-sm font-medium mb-2 block">Perfil de Marca</label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
              disabled={isGenerating}
            >
              <option value="">Selecione um perfil...</option>
              {brandProfiles.map(profile => {
                const stats = getProfileStats(profile);
                return (
                  <option key={profile.id} value={profile.id}>
                    {profile.brandName} {stats.hasKeywords ? `(${stats.safe} keywords)` : '(sem keywords)'}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Status do perfil selecionado */}
          {selectedProfile && (() => {
            const profile = brandProfiles.find(p => p.id === selectedProfile);
            const stats = profile ? getProfileStats(profile) : null;
            
            return stats && (
              <div className="p-3 bg-muted rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Status Atual:</span>
                  {stats.lastUpdate && (
                    <span className="text-xs text-muted-foreground flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {new Date(stats.lastUpdate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Badge variant="default" className="text-xs">
                    ✅ Seguras: {stats.safe}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    ⚠️ Moderadas: {stats.moderate}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    ❌ Perigosas: {stats.dangerous}
                  </Badge>
                </div>
              </div>
            );
          })()}

          {/* Botão de Gerar */}
          <Button 
            onClick={generateKeywords}
            disabled={!selectedProfile || isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando Keywords...
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Gerar Keywords Seguras
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados da Última Geração */}
      {lastResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="h-5 w-5 mr-2 text-green-500" />
                Keywords Geradas para {lastResults.profileName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Estatísticas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {lastResults.stats.safe}
                  </div>
                  <div className="text-sm text-muted-foreground">Seguras</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">
                    {lastResults.stats.moderate}
                  </div>
                  <div className="text-sm text-muted-foreground">Moderadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {lastResults.stats.dangerous}
                  </div>
                  <div className="text-sm text-muted-foreground">Perigosas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {lastResults.stats.total}
                  </div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
              </div>

              {/* Keywords Seguras (usadas na busca) */}
              {lastResults.keywords.safe.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2 flex items-center text-green-600">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Keywords Seguras (Usadas na Busca Real)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {lastResults.keywords.safe.slice(0, 15).map((keyword, index) => (
                      <Badge key={index} variant="default" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {lastResults.keywords.safe.length > 15 && (
                      <Badge variant="outline" className="text-xs">
                        +{lastResults.keywords.safe.length - 15} mais
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords Moderadas (precisam review) */}
              {lastResults.keywords.moderate.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2 flex items-center text-yellow-600">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Keywords Moderadas (Precisam Review)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {lastResults.keywords.moderate.slice(0, 10).map((keyword, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {lastResults.keywords.moderate.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{lastResults.keywords.moderate.length - 10} mais
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords Perigosas (bloqueadas) */}
              {lastResults.keywords.dangerous.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 flex items-center text-red-600">
                    <X className="h-4 w-4 mr-2" />
                    Keywords Perigosas (Bloqueadas)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {lastResults.keywords.dangerous.slice(0, 5).map((keyword, index) => (
                      <Badge key={index} variant="destructive" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {lastResults.keywords.dangerous.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{lastResults.keywords.dangerous.length - 5} mais
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Aviso sobre segurança */}
              <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start">
                  <Shield className="h-4 w-4 text-blue-500 mr-2 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Sistema de Segurança Ativo</p>
                    <p>Apenas keywords <strong>seguras</strong> serão usadas na busca real. Keywords moderadas precisam de aprovação manual, e keywords perigosas são automaticamente bloqueadas para evitar falsos positivos.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
