# Analytics Dashboard Usage Guide

## Overview
The DMCA Guard Analytics Dashboard provides comprehensive insights into your content protection performance with real-time metrics, beautiful visualizations, and export capabilities.

## Access
Navigate to `/dashboard/analytics` to access the full analytics dashboard.

## Dashboard Structure

### 1. Header Controls
- **Period Selector**: Choose from predefined periods (Today, 7d, 30d, 90d) or custom date ranges
- **Export Menu**: Export data as PDF, Excel, or CSV

### 2. KPI Grid
Eight key performance indicators displayed in a responsive grid:

- **Total Violations**: All-time count with 30-day comparison
- **Success Rate**: Percentage of successful takedowns
- **Detection Time**: Average time to detect violations
- **Coverage**: Number of sites monitored
- **Takedowns Sent**: Total removal requests
- **Active Profiles**: Current brand profiles
- **Active Scans**: Running monitoring sessions
- **Effectiveness**: Overall protection score

### 3. Tabbed Sections

#### Overview Tab
- Violations trend chart
- Takedown success rate gauge
- Platform distribution pie chart
- Top keywords bar chart

#### Violations Tab
- Detailed violation trends over time
- Distribution by platform
- Top 10 violated keywords
- Activity heatmap (hour/day matrix)

#### Takedowns Tab
- Success rate with status breakdown
- Response time by platform
- Agent performance radar chart

#### Business Tab
- User growth over time
- Plan distribution with revenue
- Average revenue per user

## Component Usage

### Embedding Individual Charts

```typescript
import { ViolationsTrendChart } from '@/components/analytics/violations/trend-chart'
import { TakedownSuccessRate } from '@/components/analytics/takedowns/success-rate'

function MyDashboard() {
  const analyticsData = await fetchAnalytics()
  
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ViolationsTrendChart period="30d" />
      <TakedownSuccessRate data={analyticsData} />
    </div>
  )
}
```

### Using KPI Cards

```typescript
import { KpiCard } from '@/components/analytics/kpi-card'
import { Shield, TrendingUp } from 'lucide-react'

<KpiCard
  title="Protection Score"
  value="95%"
  subtitle="Last 30 days"
  icon={Shield}
  trend="up"
  trendValue="+5%"
/>
```

### Custom Period Selection

```typescript
import { PeriodSelector } from '@/components/analytics/period-selector'

function MyComponent() {
  const [period, setPeriod] = useState<Period>('30d')
  const [customDates, setCustomDates] = useState<{ from: Date; to: Date }>()
  
  return (
    <PeriodSelector
      period={period}
      onPeriodChange={setPeriod}
      customDates={customDates}
      onCustomDatesChange={setCustomDates}
    />
  )
}
```

## API Integration

### Fetching Analytics Data

```typescript
// Get analytics summary
const response = await fetch('/api/analytics/summary')
const data = await response.json()

// Response structure
{
  success: true,
  data: {
    // KPIs
    successRate: 85,
    coverage: 150,
    takedownsSent: 1250,
    totalDetectedContent: 3420,
    detectedContentLast30Days: 320,
    successfulTakedowns: 1062,
    activeBrandProfiles: 12,
    activeMonitoringSessions: 5,
    recentNotifications: 8,
    
    // Distributions
    takedownsByStatus: {
      'Pendente': 125,
      'Enviado': 63,
      'Removido': 1062,
      'Rejeitado': 0
    },
    
    // Calculated metrics
    effectiveness: 92,
    averageResponseTime: 24,
    
    // Trends
    trends: {
      detections: 'up',
      takedowns: 'up',
      effectiveness: 'neutral'
    },
    
    // Period info
    periodStart: '2024-01-01T00:00:00Z',
    periodEnd: '2024-01-31T23:59:59Z',
    generatedAt: '2024-01-31T15:30:00Z'
  }
}
```

## Export Functionality

### Export Formats

1. **PDF Export**
   - Full dashboard report with charts
   - Executive summary
   - Detailed metrics tables

2. **Excel Export**
   - Multiple sheets for different metrics
   - Raw data for custom analysis
   - Pivot table ready format

3. **CSV Export**
   - Simple tabular format
   - Easy import to other tools
   - Time-series data included

### Implementation Example

```typescript
const handleExport = async (format: 'pdf' | 'excel' | 'csv') => {
  const data = await fetchAnalyticsData()
  
  switch (format) {
    case 'pdf':
      await exportToPDF(data)
      break
    case 'excel':
      await exportToExcel(data)
      break
    case 'csv':
      await exportToCSV(data)
      break
  }
}
```

## Chart Customization

### Custom Colors

```typescript
const CUSTOM_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6']

<PieChart data={data}>
  <Pie dataKey="value">
    {data.map((entry, index) => (
      <Cell key={index} fill={CUSTOM_COLORS[index % CUSTOM_COLORS.length]} />
    ))}
  </Pie>
</PieChart>
```

### Custom Tooltips

```typescript
const CustomTooltip = ({ active, payload }) => {
  if (active && payload) {
    return (
      <div className="bg-background p-2 border rounded shadow">
        <p>{payload[0].name}: {payload[0].value}</p>
      </div>
    )
  }
  return null
}
```

## Performance Optimization

1. **Data Caching**: Analytics data is cached for 1 hour
2. **Lazy Loading**: Charts load on-demand as tabs are selected
3. **Virtualization**: Long lists use virtual scrolling
4. **Memoization**: Heavy components use React.memo

## Best Practices

1. **Regular Monitoring**: Check analytics daily for trends
2. **Period Comparison**: Use custom periods to compare performance
3. **Export Reports**: Generate monthly reports for stakeholders
4. **Act on Insights**: Use data to optimize protection strategies
5. **Set Alerts**: Configure notifications for metric thresholds

## Troubleshooting

### Charts not loading
- Check API connectivity
- Verify authentication
- Clear browser cache

### Export failing
- Check file download permissions
- Verify sufficient data exists
- Try smaller date ranges

### Slow performance
- Reduce date range
- Check network speed
- Enable browser caching