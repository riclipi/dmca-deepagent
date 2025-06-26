import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { KnownSitesImporter } from '@/lib/data-import/known-sites-importer'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import * as fs from 'fs/promises'
import * as path from 'path'
import { writeFile } from 'fs/promises'

const prisma = new PrismaClient()

// Schema para importação de array
const ImportArraySchema = z.object({
  sites: z.array(z.object({
    url: z.string().url(),
    category: z.string().optional(),
    platform: z.string().optional(),
    violationCount: z.number().optional(),
    lastSeen: z.string().optional(),
    riskScore: z.number().min(0).max(100).optional()
  })),
  overwrite: z.boolean().default(false)
})

// Schema para validação de CSV
const ImportOptionsSchema = z.object({
  overwrite: z.boolean().default(false),
  skipDuplicates: z.boolean().default(true),
  validateUrls: z.boolean().default(true),
  maxRows: z.number().min(1).max(10000).default(1000)
})

/**
 * POST /api/known-sites/import
 * Importar sites de CSV ou array JSON
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const contentType = request.headers.get('content-type') || ''

    let result

    if (contentType.includes('multipart/form-data')) {
      // Upload de arquivo CSV
      result = await handleCsvUpload(request, session.user.id)
    } else if (contentType.includes('application/json')) {
      // Importação de array JSON
      result = await handleJsonImport(request, session.user.id)
    } else {
      return NextResponse.json(
        { error: 'Content-Type não suportado. Use multipart/form-data para CSV ou application/json para array.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: result.success,
      summary: {
        totalProcessed: result.totalProcessed,
        totalImported: result.totalImported,
        duplicates: result.duplicates,
        errors: result.errors.length
      },
      details: {
        errors: result.errors.slice(0, 10), // Primeiros 10 erros
        hasMoreErrors: result.errors.length > 10
      }
    }, { 
      status: result.success ? 200 : 207 // 207 = Multi-Status (sucesso parcial)
    })

  } catch (error) {
    console.error('Erro na importação:', error)
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
 * Processar upload de CSV
 */
async function handleCsvUpload(request: NextRequest, userId: string) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const optionsStr = formData.get('options') as string

  if (!file) {
    throw new Error('Arquivo não fornecido')
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    throw new Error('Arquivo deve ter extensão .csv')
  }

  if (file.size > 5 * 1024 * 1024) { // 5MB
    throw new Error('Arquivo muito grande. Máximo 5MB.')
  }

  // Parse opções
  let options = {}
  try {
    if (optionsStr) {
      options = ImportOptionsSchema.parse(JSON.parse(optionsStr))
    }
  } catch (error) {
    console.warn('Opções inválidas, usando padrão:', error)
  }

  // Salvar arquivo temporariamente
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  
  const tempDir = path.join(process.cwd(), 'temp')
  await fs.mkdir(tempDir, { recursive: true })
  
  const tempFilePath = path.join(tempDir, `import-${Date.now()}-${file.name}`)
  await writeFile(tempFilePath, buffer)

  try {
    // Processar importação
    const importer = new KnownSitesImporter(userId)
    const result = await importer.importFromCSV(tempFilePath)

    // Limpar arquivo temporário
    await fs.unlink(tempFilePath).catch(console.warn)

    return result
  } catch (error) {
    // Limpar arquivo temporário em caso de erro
    await fs.unlink(tempFilePath).catch(console.warn)
    throw error
  }
}

/**
 * Processar importação de JSON
 */
async function handleJsonImport(request: NextRequest, userId: string) {
  const body = await request.json()
  const validatedData = ImportArraySchema.parse(body)

  const importer = new KnownSitesImporter(userId)
  return await importer.importFromArray(validatedData.sites as any)
}

/**
 * GET /api/known-sites/import/template
 * Baixar template CSV para importação
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'

    if (format === 'csv') {
      const csvTemplate = `url,category,platform,violation_count,risk_score,last_seen
https://example.com,FORUM,discourse,0,50,
https://social.example.com,SOCIAL_MEDIA,custom,5,75,2024-01-15
https://files.example.com,FILE_SHARING,mediafire,2,60,2024-01-10
https://chat.example.com,MESSAGING,discord,0,30,
https://adult.example.com,ADULT_CONTENT,custom,10,90,2024-01-01`

      return new NextResponse(csvTemplate, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="known-sites-template.csv"'
        }
      })
    }

    if (format === 'json') {
      const jsonTemplate = {
        sites: [
          {
            url: "https://example.com",
            category: "FORUM",
            platform: "discourse",
            violationCount: 0,
            riskScore: 50
          },
          {
            url: "https://social.example.com", 
            category: "SOCIAL_MEDIA",
            platform: "custom",
            violationCount: 5,
            riskScore: 75,
            lastSeen: "2024-01-15"
          }
        ],
        overwrite: false
      }

      return NextResponse.json(jsonTemplate, {
        headers: {
          'Content-Disposition': 'attachment; filename="known-sites-template.json"'
        }
      })
    }

    return NextResponse.json(
      { error: 'Formato não suportado. Use "csv" ou "json".' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Erro ao gerar template:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/known-sites/import
 * Limpar importação (reverter última importação)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const minutes = parseInt(searchParams.get('minutes') || '60')

    if (minutes > 1440) { // Máximo 24 horas
      return NextResponse.json(
        { error: 'Período máximo para reversão é de 24 horas' },
        { status: 400 }
      )
    }

    // Deletar sites importados recentemente
    const cutoffDate = new Date(Date.now() - minutes * 60 * 1000)
    
    const deletedSites = await prisma.knownSite.deleteMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: cutoffDate
        }
      }
    })

    return NextResponse.json({
      message: `Importação revertida. ${deletedSites.count} sites removidos.`,
      deletedCount: deletedSites.count,
      cutoffDate: cutoffDate.toISOString()
    })

  } catch (error) {
    console.error('Erro ao reverter importação:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}