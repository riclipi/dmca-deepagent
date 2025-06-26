'use client'

import { useState } from 'react'

interface AnalysisSession {
  urlsAnalyzed: number
  violationsConfirmed: number
  geminiCost: number
  avgAnalysisTime: number
}

interface Analysis {
  url: string
  detailedAnalysis: string
  riskScore: number
  confidence: number
  recommendedAction: string
}

interface Activity {
  timestamp: string
  message: string
  error?: string
}

// Stub components
function Button({ children, variant, onClick, disabled }: any) {
  return (
    <button 
      className={`px-4 py-2 rounded ${variant === 'outline' ? 'border' : 'bg-blue-500 text-white'} ${disabled ? 'opacity-50' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function Card({ children }: any) {
  return <div className="border rounded p-4">{children}</div>
}

function CardHeader({ children }: any) {
  return <div className="border-b pb-2 mb-4">{children}</div>
}

function CardTitle({ children }: any) {
  return <h3 className="text-lg font-semibold">{children}</h3>
}

function CardContent({ children, className }: any) {
  return <div className={className}>{children}</div>
}

function Label({ children }: any) {
  return <label className="block text-sm font-medium mb-1">{children}</label>
}

function Select({ children, value, onValueChange }: any) {
  return (
    <select 
      value={value} 
      onChange={(e) => onValueChange?.(e.target.value)}
      className="w-full border rounded px-3 py-2"
    >
      {children}
    </select>
  )
}

function SelectTrigger({ children }: any) {
  return <div>{children}</div>
}

function SelectValue() {
  return null
}

function SelectContent({ children }: any) {
  return <>{children}</>
}

function SelectItem({ children, value }: any) {
  return <option value={value}>{children}</option>
}

function Checkbox({ children, checked, onCheckedChange }: any) {
  return (
    <label className="flex items-center space-x-2">
      <input 
        type="checkbox" 
        checked={checked} 
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

function StatCard({ title, value, subtitle }: any) {
  return (
    <div className="border rounded p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-gray-500">{subtitle}</div>
    </div>
  )
}

function Badge({ children, variant }: any) {
  return (
    <span className={`px-2 py-1 rounded text-xs ${
      variant === 'destructive' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
    }`}>
      {children}
    </span>
  )
}

export default function ContextualAgentPage() {
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-flash-8b')
  const [temperature, setTemperature] = useState('0.1')
  const [maxTokens, setMaxTokens] = useState('1000')
  const [analyzeText, setAnalyzeText] = useState(true)
  const [analyzeImages, setAnalyzeImages] = useState(true)
  const [analyzeContext, setAnalyzeContext] = useState(true)
  const [generateReport, setGenerateReport] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  
  const session: AnalysisSession = {
    urlsAnalyzed: 0,
    violationsConfirmed: 0,
    geminiCost: 0,
    avgAnalysisTime: 0
  }
  
  const recentAnalyses: Analysis[] = []
  const activityLog: Activity[] = []
  
  const startAnalysis = () => {
    setIsAnalyzing(true)
    // Implementação futura
  }
  
  const generateReportHandler = () => {
    // Implementação futura
  }
  
  const getRiskBadgeVariant = (score: number) => {
    return score > 70 ? 'destructive' : 'default'
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Agente de Análise Contextual</h1>
          <p className="text-gray-600">
            Análise avançada via Gemini AI para classificação inteligente de violações
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReportHandler}>
            Gerar Relatório
          </Button>
          <Button onClick={startAnalysis} disabled={isAnalyzing}>
            {isAnalyzing ? 'Analisando...' : 'Iniciar Análise'}
          </Button>
        </div>
      </div>
      
      {/* Configurações de análise */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Análise</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Modelo Gemini</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-1.5-flash-8b">Flash 8B (Rápido)</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Flash (Balanceado)</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Pro (Máxima qualidade)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Temperatura de Análise</Label>
              <Select value={temperature} onValueChange={setTemperature}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">0.1 (Determinístico)</SelectItem>
                  <SelectItem value="0.3">0.3 (Balanceado)</SelectItem>
                  <SelectItem value="0.5">0.5 (Criativo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Limite de Tokens</Label>
              <Select value={maxTokens} onValueChange={setMaxTokens}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">500 (Conciso)</SelectItem>
                  <SelectItem value="1000">1000 (Detalhado)</SelectItem>
                  <SelectItem value="2000">2000 (Extensivo)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="mt-4">
            <Label>Tipos de Análise</Label>
            <div className="flex gap-4 mt-2">
              <Checkbox checked={analyzeText} onCheckedChange={setAnalyzeText}>
                Análise de Texto
              </Checkbox>
              <Checkbox checked={analyzeImages} onCheckedChange={setAnalyzeImages}>
                Análise de Imagens
              </Checkbox>
              <Checkbox checked={analyzeContext} onCheckedChange={setAnalyzeContext}>
                Análise Contextual
              </Checkbox>
              <Checkbox checked={generateReport} onCheckedChange={setGenerateReport}>
                Relatório Executivo
              </Checkbox>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Métricas de performance */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          title="URLs Analisadas" 
          value={session?.urlsAnalyzed || 0}
          subtitle="Total processado"
        />
        <StatCard 
          title="Violações Confirmadas" 
          value={session?.violationsConfirmed || 0}
          subtitle="Alto nível de confiança"
        />
        <StatCard 
          title="Custo Gemini" 
          value={`$${session?.geminiCost?.toFixed(2) || '0.00'}`}
          subtitle="Sessão atual"
        />
        <StatCard 
          title="Tempo Médio" 
          value={`${session?.avgAnalysisTime || 0}s`}
          subtitle="Por análise"
        />
      </div>
      
      {/* Resultados de análise em tempo real */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Análises Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAnalyses.map((analysis, index) => (
              <div key={index} className="border rounded p-3">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{analysis.url}</p>
                    <p className="text-xs text-muted-foreground">{analysis.detailedAnalysis.substring(0, 100)}...</p>
                  </div>
                  <Badge variant={getRiskBadgeVariant(analysis.riskScore)}>
                    {analysis.riskScore}% risco
                  </Badge>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Confiança: {(analysis.confidence * 100).toFixed(1)}%</span>
                  <span>{analysis.recommendedAction}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Log de Atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activityLog.map((activity, index) => (
                <div key={index} className="text-sm">
                  <span className="text-muted-foreground text-xs">{activity.timestamp}</span>
                  <p className="mt-1">{activity.message}</p>
                  {activity.error && (
                    <p className="text-red-600 text-xs mt-1">{activity.error}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
