import { AnalyticsData, ExportOptions } from '@/types/analytics'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export class AnalyticsExportService {
  /**
   * Export analytics data to CSV format
   */
  static async exportToCSV(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    const rows: string[] = []
    
    // Header
    rows.push('DMCA Guard Analytics Report')
    rows.push(`Period: ${this.formatPeriod(options)}`)
    rows.push(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`)
    rows.push('')
    
    // KPIs Section
    rows.push('Key Performance Indicators')
    rows.push('Metric,Value')
    rows.push(`Total Violations,${data.totalDetectedContent}`)
    rows.push(`Violations (Last 30 days),${data.detectedContentLast30Days}`)
    rows.push(`Success Rate,${data.successRate}%`)
    rows.push(`Coverage,${data.coverage}`)
    rows.push(`Takedowns Sent,${data.takedownsSent}`)
    rows.push(`Successful Takedowns,${data.successfulTakedowns}`)
    rows.push(`Active Brand Profiles,${data.activeBrandProfiles}`)
    rows.push(`Active Monitoring Sessions,${data.activeMonitoringSessions}`)
    rows.push(`Effectiveness Score,${data.effectiveness}%`)
    rows.push('')
    
    // Takedown Status Distribution
    rows.push('Takedown Status Distribution')
    rows.push('Status,Count')
    Object.entries(data.takedownsByStatus).forEach(([status, count]) => {
      rows.push(`${status},${count}`)
    })
    rows.push('')
    
    // Trends
    rows.push('Trends')
    rows.push('Metric,Direction')
    rows.push(`Detections,${data.trends.detections}`)
    rows.push(`Takedowns,${data.trends.takedowns}`)
    rows.push(`Effectiveness,${data.trends.effectiveness}`)
    
    const csvContent = rows.join('\n')
    return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  }

  /**
   * Export analytics data to Excel format
   */
  static async exportToExcel(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    // Dynamic import to avoid loading heavy library unless needed
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    
    // Metadata
    workbook.creator = 'DMCA Guard Platform'
    workbook.created = new Date()
    
    // KPIs Sheet
    const kpiSheet = workbook.addWorksheet('KPIs')
    kpiSheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Value', key: 'value', width: 20 },
      { header: 'Trend', key: 'trend', width: 15 }
    ]
    
    kpiSheet.addRows([
      { metric: 'Total Violations', value: data.totalDetectedContent },
      { metric: 'Violations (Last 30 days)', value: data.detectedContentLast30Days },
      { metric: 'Success Rate', value: `${data.successRate}%` },
      { metric: 'Coverage', value: data.coverage },
      { metric: 'Takedowns Sent', value: data.takedownsSent },
      { metric: 'Successful Takedowns', value: data.successfulTakedowns },
      { metric: 'Active Brand Profiles', value: data.activeBrandProfiles },
      { metric: 'Active Monitoring Sessions', value: data.activeMonitoringSessions },
      { metric: 'Effectiveness Score', value: `${data.effectiveness}%` }
    ])
    
    // Style header row
    kpiSheet.getRow(1).font = { bold: true }
    kpiSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    }
    kpiSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } }
    
    // Takedown Status Sheet
    const statusSheet = workbook.addWorksheet('Takedown Status')
    statusSheet.columns = [
      { header: 'Status', key: 'status', width: 25 },
      { header: 'Count', key: 'count', width: 15 }
    ]
    
    Object.entries(data.takedownsByStatus).forEach(([status, count]) => {
      statusSheet.addRow({ status, count })
    })
    
    // Style header
    statusSheet.getRow(1).font = { bold: true }
    statusSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' }
    }
    statusSheet.getRow(1).font = { color: { argb: 'FFFFFFFF' } }
    
    // Add summary sheet
    const summarySheet = workbook.addWorksheet('Summary')
    summarySheet.addRow(['DMCA Guard Analytics Report'])
    summarySheet.addRow([`Period: ${this.formatPeriod(options)}`])
    summarySheet.addRow([`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`])
    summarySheet.addRow([])
    summarySheet.addRow(['Executive Summary'])
    summarySheet.addRow([`Your content protection effectiveness is ${data.effectiveness}%`])
    summarySheet.addRow([`You have successfully removed ${data.successfulTakedowns} infringing contents`])
    summarySheet.addRow([`Success rate: ${data.successRate}%`])
    
    // Style summary
    summarySheet.getRow(1).font = { bold: true, size: 16 }
    summarySheet.getRow(5).font = { bold: true, size: 14 }
    
    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer()
    return new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
  }

  /**
   * Export analytics data to PDF format
   */
  static async exportToPDF(data: AnalyticsData, options: ExportOptions): Promise<Blob> {
    // Dynamic import to avoid loading heavy library unless needed
    const jsPDF = (await import('jspdf')).default
    await import('jspdf-autotable')
    
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(20)
    doc.setTextColor(59, 130, 246) // Blue color
    doc.text('DMCA Guard Analytics Report', 14, 20)
    
    // Metadata
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Period: ${this.formatPeriod(options)}`, 14, 30)
    doc.text(`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 35)
    
    // Executive Summary
    doc.setFontSize(14)
    doc.setTextColor(0)
    doc.text('Executive Summary', 14, 50)
    
    doc.setFontSize(11)
    doc.setTextColor(60)
    const summaryY = 60
    doc.text(`• Content Protection Effectiveness: ${data.effectiveness}%`, 20, summaryY)
    doc.text(`• Total Violations Detected: ${data.totalDetectedContent.toLocaleString()}`, 20, summaryY + 7)
    doc.text(`• Successful Takedowns: ${data.successfulTakedowns.toLocaleString()} (${data.successRate}% success rate)`, 20, summaryY + 14)
    doc.text(`• Active Monitoring: ${data.activeMonitoringSessions} sessions across ${data.coverage} sites`, 20, summaryY + 21)
    
    // KPIs Table
    const kpiData = [
      ['Total Violations', data.totalDetectedContent.toLocaleString()],
      ['Last 30 Days', data.detectedContentLast30Days.toLocaleString()],
      ['Success Rate', `${data.successRate}%`],
      ['Coverage', data.coverage.toLocaleString()],
      ['Takedowns Sent', data.takedownsSent.toLocaleString()],
      ['Effectiveness', `${data.effectiveness}%`]
    ]
    
    ;(doc as any).autoTable({
      head: [['Key Performance Indicator', 'Value']],
      body: kpiData,
      startY: 95,
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    })
    
    // Takedown Status
    const statusData = Object.entries(data.takedownsByStatus).map(([status, count]) => [
      status,
      count.toLocaleString()
    ])
    
    ;(doc as any).autoTable({
      head: [['Status', 'Count']],
      body: statusData,
      startY: (doc as any).lastAutoTable.finalY + 15,
      headStyles: { fillColor: [59, 130, 246] },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    })
    
    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(10)
      doc.setTextColor(150)
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      )
    }
    
    return doc.output('blob')
  }

  /**
   * Format period for display
   */
  private static formatPeriod(options: ExportOptions): string {
    if (options.period === 'today') return 'Today'
    if (options.period === '7d') return 'Last 7 days'
    if (options.period === '30d') return 'Last 30 days'
    if (options.period === '90d') return 'Last 90 days'
    if (options.period === 'custom' && options.customDates) {
      return `${format(options.customDates.from, 'dd/MM/yyyy', { locale: ptBR })} - ${format(options.customDates.to, 'dd/MM/yyyy', { locale: ptBR })}`
    }
    return 'All time'
  }

  /**
   * Download file helper
   */
  static downloadFile(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }
}