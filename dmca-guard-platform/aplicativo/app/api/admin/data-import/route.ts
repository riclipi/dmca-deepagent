import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HistoricalViolationsImporter } from '@/lib/data-import/historical-violations-importer'
import { z } from 'zod'
import * as path from 'path'

// Schema para validação do request
const ImportRequestSchema = z.object({
  filePath: z.string().min(1, 'Caminho do arquivo é obrigatório'),
  options: z.object({
    batchSize: z.number().min(10).max(1000).optional(),
    validateUrls: z.boolean().optional(),
    extractPatterns: z.boolean().optional(),
    userId: z.string().optional()
  }).optional()
})

/**
 * POST /api/admin/data-import
 * Importar dados históricos de violações
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se usuário é admin (implementar verificação de role se necessário)
    // Por enquanto, qualquer usuário autenticado pode importar

    // Validar dados do request
    const body = await request.json()
    const validatedData = ImportRequestSchema.parse(body)

    // Verificar se arquivo existe no caminho especificado
    const absolutePath = path.resolve(validatedData.filePath)
    
    // Inicializar importador
    const importer = new HistoricalViolationsImporter()

    // Configurar opções
    const options = {
      batchSize: 100,
      validateUrls: true,
      extractPatterns: true,
      userId: session.user.id,
      ...validatedData.options
    }

    // Executar importação
    const result = await importer.importHistoricalData(absolutePath, options)

    return NextResponse.json({
      success: true,
      message: 'Importação concluída com sucesso',
      result: {
        totalImported: result.totalImported,
        totalSkipped: result.totalSkipped,
        totalErrors: result.totalErrors,
        duplicatesFound: result.duplicatesFound,
        processingTimeMs: result.processingTime,
        processingTimeFormatted: formatDuration(result.processingTime),
        patternsExtracted: {
          keywordCount: Object.keys(result.patternsExtracted.keywordFrequency).length,
          platformCount: Object.keys(result.patternsExtracted.platformDistribution).length,
          domainPatternsCount: result.patternsExtracted.commonDomainPatterns.length
        },
        platformsIdentified: {
          totalPlatforms: result.platformsIdentified.identifiedPlatforms.length,
          suspiciousDomains: result.platformsIdentified.suspiciousDomains.length,
          categories: result.platformsIdentified.platformCategories
        }
      }
    })

  } catch (error) {
    console.error('Erro durante importação:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      if (error.message.includes('não encontrado')) {
        return NextResponse.json(
          { error: 'Arquivo não encontrado' },
          { status: 404 }
        )
      }

      if (error.message.includes('não suportado')) {
        return NextResponse.json(
          { error: 'Formato de arquivo não suportado' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/data-import
 * Obter estatísticas de importação e dados históricos
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'status') {
      // Retornar status da importação (implementar se necessário)
      return NextResponse.json({
        importInProgress: false,
        lastImportDate: null,
        totalViolationsInDatabase: 0, // Implementar consulta ao banco
        supportedFormats: ['csv', 'json', 'txt']
      })
    }

    if (action === 'export') {
      // Exportar dados processados
      const format = searchParams.get('format') || 'json'
      const outputPath = searchParams.get('outputPath') || '/tmp/exported_data.json'

      const importer = new HistoricalViolationsImporter()
      await importer.exportProcessedData(outputPath, format as 'json' | 'csv')

      return NextResponse.json({
        success: true,
        message: 'Dados exportados com sucesso',
        outputPath
      })
    }

    // Retornar informações gerais sobre importação
    return NextResponse.json({
      supportedFormats: [
        {
          extension: 'csv',
          description: 'Arquivo CSV com colunas: url, title, description, platform, category, dateDetected, riskLevel',
          example: 'violations.csv'
        },
        {
          extension: 'json',
          description: 'Arquivo JSON com array de objetos contendo dados de violação',
          example: 'violations.json'
        },
        {
          extension: 'txt',
          description: 'Arquivo de texto simples com uma URL por linha',
          example: 'urls.txt'
        }
      ],
      requiredFields: {
        csv: ['url'],
        json: ['url'],
        txt: ['url (uma por linha)']
      },
      optionalFields: {
        title: 'Título da página/conteúdo',
        description: 'Descrição da violação',
        platform: 'Plataforma onde foi encontrada',
        category: 'Categoria do site (FORUM, SOCIAL_MEDIA, etc.)',
        dateDetected: 'Data de detecção',
        riskLevel: 'Nível de risco (LOW, MEDIUM, HIGH, CRITICAL)',
        keywords: 'Palavras-chave relacionadas',
        takedownDate: 'Data de remoção (se aplicável)',
        isResolved: 'Se a violação foi resolvida'
      },
      limits: {
        maxFileSize: '100MB',
        maxRecords: 50000,
        batchSize: '10-1000 registros por lote'
      }
    })

  } catch (error) {
    console.error('Erro ao obter informações de importação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * Formatar duração em ms para string legível
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}
