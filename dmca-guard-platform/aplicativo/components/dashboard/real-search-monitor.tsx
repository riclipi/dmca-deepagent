// components/dashboard/real-search-monitor.tsx - Monitor de Busca Real

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  Play, 
  Pause, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  Zap,
  Target,
  Globe,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';

interface BrandProfile {
  id: string;
  brandName: string;
  keywords: string[];
  safeKeywords: string[];
}

interface MonitoringSession {
  id: string;
  name: string;
  brandProfileId: string;
  status: 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  progress: number;
  currentKeyword?: string;
  totalKeywords: number;
  processedKeywords: number;
  resultsFound: number;
  lastScanAt?: string;
  nextScanAt?: string;
}

interface SearchResults {
  totalSearched: number;
  newDetections: number;
  keywordsProcessed: number;
  confidence: {
    high: number;
    medium: number;
    low: number;
  };
  platforms: string[];
}

interface RealSearchMonitorProps {
  brandProfiles: BrandProfile[];
  onSearchComplete?: (results: SearchResults) => void;
}

export default function RealSearchMonitor({ 
  brandProfiles, 
  onSearchComplete 
}: RealSearchMonitorProps) {
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [monitoringSessions, setMonitoringSessions] = useState<MonitoringSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [currentKeyword, setCurrentKeyword] = useState<string>('');
  const [lastResults, setLastResults] = useState<SearchResults | null>(null);
  
  const { toast } = useToast();

  // Carregar sessões de monitoramento
  useEffect(() => {
    if (selectedProfile) {
      fetchMonitoringSessions();
    }
  }, [selectedProfile]);

  // Monitor de progresso em tempo real
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isSearching && selectedSession) {
      interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/scan/real-search?sessionId=${selectedSession}`);
          if (response.ok) {
            const data = await response.json();
            setSearchProgress(data.progress || 0);
            setCurrentKeyword(data.currentKeyword || '');
            
            if (data.status === 'COMPLETED' || data.status === 'ERROR') {
              setIsSearching(false);
              if (data.status === 'COMPLETED') {
                toast({
                  title: "🎉 Busca Concluída!",
                  description: `Encontrados ${data.resultsFound} novos vazamentos potenciais`,
                });
              }
            }
          }
        } catch (error) {
          console.error('Erro monitorando progresso:', error);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSearching, selectedSession]);

  const fetchMonitoringSessions = async () => {
    try {
      const response = await fetch(`/api/monitoring-sessions?brandProfileId=${selectedProfile}`);
      if (response.ok) {
        const data = await response.json();
        setMonitoringSessions(data.sessions || []);
        if (data.sessions?.length > 0) {
          setSelectedSession(data.sessions[0].id);
        }
      }
    } catch (error) {
      console.error('Erro carregando sessões:', error);
    }
  };

  const startRealSearch = async () => {
    if (!selectedProfile || !selectedSession) {
      toast({
        title: "Erro",
        description: "Selecione um perfil de marca e sessão de monitoramento",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    setSearchProgress(0);
    setCurrentKeyword('Iniciando...');

    try {
      const response = await fetch('/api/scan/real-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandProfileId: selectedProfile,
          monitoringSessionId: selectedSession,
          maxResults: 100
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setLastResults(data.results);
        if (onSearchComplete) {
          onSearchComplete(data.results);
        }
        
        toast({
          title: "✅ Busca Real Concluída!",
          description: data.message,
        });
      } else {
        throw new Error(data.error || 'Erro na busca');
      }
    } catch (error) {
      console.error('Erro na busca real:', error);
      toast({
        title: "❌ Erro na Busca",
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
      setSearchProgress(0);
      setCurrentKeyword('');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'RUNNING': return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ERROR': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING': return 'bg-blue-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'ERROR': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Controles de Busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="h-5 w-5 mr-2 text-yellow-500" />
            Busca Real de Vazamentos
          </CardTitle>
          <CardDescription>
            Execute buscas reais usando múltiplas fontes para encontrar conteúdo vazado
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
              disabled={isSearching}
            >
              <option value="">Selecione um perfil...</option>
              {brandProfiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.brandName} ({profile.safeKeywords?.length || 0} keywords)
                </option>
              ))}
            </select>
          </div>

          {/* Seleção de Sessão */}
          {selectedProfile && (
            <div>
              <label className="text-sm font-medium mb-2 block">Sessão de Monitoramento</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full p-2 border rounded-md bg-background"
                disabled={isSearching}
              >
                <option value="">Selecione uma sessão...</option>
                {monitoringSessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.name} - {getStatusIcon(session.status)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão de Iniciar */}
          <Button 
            onClick={startRealSearch}
            disabled={!selectedProfile || !selectedSession || isSearching}
            className="w-full"
            size="lg"
          >
            {isSearching ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Buscando...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Busca Real
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Progresso da Busca */}
      {isSearching && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2 text-blue-500" />
                Progresso da Busca
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progresso Geral</span>
                  <span>{searchProgress}%</span>
                </div>
                <Progress value={searchProgress} className="w-full" />
              </div>
              
              {currentKeyword && (
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">Keyword atual:</span> {currentKeyword}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Resultados da Última Busca */}
      {lastResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                Resultados da Última Busca
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {lastResults.totalSearched}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Encontrado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">
                    {lastResults.newDetections}
                  </div>
                  <div className="text-sm text-muted-foreground">Novos Vazamentos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {lastResults.keywordsProcessed}
                  </div>
                  <div className="text-sm text-muted-foreground">Keywords Processadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-500">
                    {lastResults.platforms.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Plataformas</div>
                </div>
              </div>

              {/* Nível de Confiança */}
              <div className="space-y-2">
                <h4 className="font-medium">Distribuição por Confiança:</h4>
                <div className="flex space-x-2">
                  <Badge variant="destructive">
                    Alta: {lastResults.confidence.high}
                  </Badge>
                  <Badge variant="secondary">
                    Média: {lastResults.confidence.medium}
                  </Badge>
                  <Badge variant="outline">
                    Baixa: {lastResults.confidence.low}
                  </Badge>
                </div>
              </div>

              {/* Plataformas Encontradas */}
              {lastResults.platforms.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Plataformas Detectadas:</h4>
                  <div className="flex flex-wrap gap-1">
                    {lastResults.platforms.map(platform => (
                      <Badge key={platform} variant="outline" className="text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
