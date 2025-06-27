import { NextRequest, NextResponse } from 'next/server'
import { RemovalVerificationAgent } from '@/lib/agents/RemovalVerificationAgent'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const verificationAgent = new RemovalVerificationAgent()

// GET /api/reports/removal-report
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Validar datas
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate e endDate são obrigatórios' },
        { status: 400 }
      )
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validar se as datas são válidas
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Datas inválidas' },
        { status: 400 }
      )
    }

    // Gerar relatório de remoções
    const report = await verificationAgent.generateRemovalReport(
      session.user.id,
      start,
      end
    )

    // Calcular métricas adicionais
    const successRate = report.totalVerifications > 0 
      ? (report.successfulRemovals / report.totalVerifications * 100).toFixed(1)
      : '0'

    const failureRate = report.totalVerifications > 0 
      ? (report.failedRemovals / report.totalVerifications * 100).toFixed(1)
      : '0'

    const pendingRate = report.totalVerifications > 0 
      ? (report.pendingVerifications / report.totalVerifications * 100).toFixed(1)
      : '0'

    return NextResponse.json({
      success: true,
      data: {
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          daysInPeriod: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        },
        metrics: {
          ...report,
          successRate: parseFloat(successRate),
          failureRate: parseFloat(failureRate),
          pendingRate: parseFloat(pendingRate),
          averageRemovalTimeFormatted: `${Math.round(report.averageRemovalTime)} horas`
        },
        summary: {
          status: report.successfulRemovals > report.failedRemovals ? 'positive' : 'warning',
          primaryInsight: generateInsight(report),
          recommendations: generateRecommendations(report)
        }
      }
    })

  } catch (error: any) {
    console.error('Erro ao gerar relatório de remoções:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

function generateInsight(report: any): string {
  if (report.totalVerifications === 0) {
    return 'Nenhuma verificação de remoção foi executada no período selecionado.'
  }

  const successRate = (report.successfulRemovals / report.totalVerifications * 100)
  
  if (successRate >= 80) {
    return `Excelente taxa de sucesso de ${successRate.toFixed(1)}% nas remoções. Seu sistema está funcionando muito bem!`
  } else if (successRate >= 60) {
    return `Boa taxa de sucesso de ${successRate.toFixed(1)}% nas remoções. Há oportunidades de melhoria.`
  } else if (successRate >= 40) {
    return `Taxa de sucesso moderada de ${successRate.toFixed(1)}%. Recomendamos revisar as estratégias de DMCA.`
  } else {
    return `Taxa de sucesso baixa de ${successRate.toFixed(1)}%. É importante revisar e otimizar o processo de takedown.`
  }
}

function generateRecommendations(report: any): string[] {
  const recommendations = []
  
  if (report.totalVerifications === 0) {
    recommendations.push('Configure verificações automáticas para monitorar a efetividade dos takedowns')
    return recommendations
  }

  const successRate = (report.successfulRemovals / report.totalVerifications * 100)
  const pendingRate = (report.pendingVerifications / report.totalVerifications * 100)

  if (successRate < 60) {
    recommendations.push('Considere revisar os templates de DMCA para torná-los mais efetivos')
    recommendations.push('Verifique se as informações de contato DMCA estão atualizadas')
  }

  if (pendingRate > 30) {
    recommendations.push('Muitas verificações estão pendentes - considere fazer revisões manuais')
  }

  if (report.averageRemovalTime > 168) { // 7 dias
    recommendations.push('Tempo médio de remoção é alto - considere fazer follow-ups mais frequentes')
  }

  if (report.proofsSaved < report.totalVerifications * 0.8) {
    recommendations.push('Habilite screenshots automáticos para melhor documentação das evidências')
  }

  if (recommendations.length === 0) {
    recommendations.push('Seu sistema está funcionando bem! Continue monitorando regularmente.')
  }

  return recommendations
}
