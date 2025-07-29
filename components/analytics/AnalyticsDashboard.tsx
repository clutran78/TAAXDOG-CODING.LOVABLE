import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  PiggyBank,
  Receipt,
  Calendar,
  AlertCircle,
  Download,
  RefreshCw,
  ChevronRight,
  Info,
  Wallet,
  ShoppingCart,
  Home,
  Car,
  Utensils,
  Zap,
  Heart,
  GraduationCap,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useRouter } from 'next/router';
import { cn } from '@/lib/utils';
import { formatCurrency, formatPercentage } from '@/lib/utils/formatters';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Types
interface AnalyticsData {
  overview: {
    totalIncome: number;
    totalExpenses: number;
    netSavings: number;
    savingsRate: number;
    transactionCount: number;
    averageTransaction: number;
    comparisonPeriod: {
      income: number;
      expenses: number;
      changePercentage: number;
    };
  };
  cashFlow: Array<{
    date: string;
    income: number;
    expenses: number;
    balance: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
    count: number;
    icon: string;
    trend: number;
  }>;
  goals: Array<{
    id: string;
    name: string;
    progress: number;
    currentAmount: number;
    targetAmount: number;
    daysRemaining: number;
    monthlyRequired: number;
    onTrack: boolean;
  }>;
  budgets: Array<{
    id: string;
    name: string;
    spent: number;
    limit: number;
    percentage: number;
    remaining: number;
    period: string;
    categories: Array<{
      category: string;
      spent: number;
      limit: number;
    }>;
  }>;
  insights: Array<{
    id: string;
    type: 'positive' | 'negative' | 'neutral' | 'warning';
    title: string;
    description: string;
    impact?: number;
    action?: {
      label: string;
      href: string;
    };
  }>;
  spendingPatterns: {
    dailyAverage: number;
    weeklyPattern: Array<{
      day: string;
      amount: number;
    }>;
    monthlyPattern: Array<{
      week: string;
      amount: number;
    }>;
    merchantFrequency: Array<{
      merchant: string;
      count: number;
      amount: number;
    }>;
  };
  taxSummary: {
    estimatedTax: number;
    deductions: number;
    taxableIncome: number;
    categories: Array<{
      category: string;
      amount: number;
      code: string;
    }>;
  };
}

// API functions
const fetchAnalytics = async (period: string): Promise<AnalyticsData> => {
  const response = await fetch(`/api/analytics/dashboard?period=${period}`);
  if (!response.ok) throw new Error('Failed to fetch analytics');
  return response.json();
};

// Chart colors
const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#10b981',
  tertiary: '#f59e0b',
  quaternary: '#ef4444',
  accent: '#8b5cf6',
  neutral: '#6b7280',
};

const CATEGORY_COLORS: Record<string, string> = {
  INCOME: '#10b981',
  HOUSING: '#3b82f6',
  TRANSPORTATION: '#f59e0b',
  FOOD: '#ef4444',
  UTILITIES: '#8b5cf6',
  INSURANCE: '#ec4899',
  HEALTHCARE: '#14b8a6',
  SAVINGS: '#06b6d4',
  PERSONAL: '#f97316',
  ENTERTAINMENT: '#a855f7',
  EDUCATION: '#6366f1',
  SHOPPING: '#84cc16',
  OTHER: '#6b7280',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  INCOME: <Wallet className="w-4 h-4" />,
  HOUSING: <Home className="w-4 h-4" />,
  TRANSPORTATION: <Car className="w-4 h-4" />,
  FOOD: <Utensils className="w-4 h-4" />,
  UTILITIES: <Zap className="w-4 h-4" />,
  HEALTHCARE: <Heart className="w-4 h-4" />,
  SAVINGS: <PiggyBank className="w-4 h-4" />,
  SHOPPING: <ShoppingCart className="w-4 h-4" />,
  EDUCATION: <GraduationCap className="w-4 h-4" />,
  ENTERTAINMENT: <Sparkles className="w-4 h-4" />,
};

export const AnalyticsDashboard: React.FC = () => {
  const router = useRouter();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics', period],
    queryFn: () => fetchAnalytics(period),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load analytics. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (isLoading || !data) {
    return <AnalyticsLoading />;
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Track your financial performance and insights
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 days</SelectItem>
                <SelectItem value="month">Last 30 days</SelectItem>
                <SelectItem value="quarter">Last 3 months</SelectItem>
                <SelectItem value="year">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push('/export')}
              className="shrink-0"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs for mobile */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="md:hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="spending">Spending</TabsTrigger>
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <OverviewCards data={data.overview} isMobile={isMobile} />
            <CashFlowChart data={data.cashFlow} isMobile={isMobile} />
          </TabsContent>

          <TabsContent value="spending" className="space-y-4 mt-4">
            <CategoryBreakdown data={data.categoryBreakdown} isMobile={isMobile} />
            <SpendingPatterns data={data.spendingPatterns} isMobile={isMobile} />
          </TabsContent>

          <TabsContent value="goals" className="space-y-4 mt-4">
            <GoalsProgress goals={data.goals} isMobile={isMobile} />
            <BudgetStatus budgets={data.budgets} isMobile={isMobile} />
          </TabsContent>

          <TabsContent value="insights" className="space-y-4 mt-4">
            <InsightsPanel insights={data.insights} />
            <TaxSummary data={data.taxSummary} isMobile={isMobile} />
          </TabsContent>
        </Tabs>

        {/* Desktop layout */}
        <div className="hidden md:block space-y-6">
          {/* Overview Cards */}
          <OverviewCards data={data.overview} isMobile={isMobile} />

          {/* Main Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <CashFlowChart data={data.cashFlow} isMobile={isMobile} />
            <CategoryBreakdown data={data.categoryBreakdown} isMobile={isMobile} />
          </div>

          {/* Goals and Budgets */}
          <div className="grid gap-6 lg:grid-cols-2">
            <GoalsProgress goals={data.goals} isMobile={isMobile} />
            <BudgetStatus budgets={data.budgets} isMobile={isMobile} />
          </div>

          {/* Insights and Patterns */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <SpendingPatterns data={data.spendingPatterns} isMobile={isMobile} />
            </div>
            <InsightsPanel insights={data.insights} />
          </div>

          {/* Tax Summary */}
          <TaxSummary data={data.taxSummary} isMobile={isMobile} />
        </div>
      </div>
    </ErrorBoundary>
  );
};

// Overview Cards Component
const OverviewCards: React.FC<{
  data: AnalyticsData['overview'];
  isMobile: boolean;
}> = ({ data, isMobile }) => {
  const cards = [
    {
      title: 'Total Income',
      value: formatCurrency(data.totalIncome),
      change: data.comparisonPeriod.income,
      icon: <TrendingUp className="h-4 w-4" />,
      color: 'text-green-600',
    },
    {
      title: 'Total Expenses',
      value: formatCurrency(data.totalExpenses),
      change: data.comparisonPeriod.expenses,
      icon: <TrendingDown className="h-4 w-4" />,
      color: 'text-red-600',
    },
    {
      title: 'Net Savings',
      value: formatCurrency(data.netSavings),
      change: data.comparisonPeriod.changePercentage,
      icon: <PiggyBank className="h-4 w-4" />,
      color: data.netSavings >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Savings Rate',
      value: formatPercentage(data.savingsRate),
      subtitle: `${data.transactionCount} transactions`,
      icon: <Target className="h-4 w-4" />,
      color: 'text-blue-600',
    },
  ];

  return (
    <div className={cn(
      "grid gap-4",
      isMobile ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"
    )}>
      {cards.map((card, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {card.title}
            </CardTitle>
            <div className={card.color}>{card.icon}</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.change !== undefined && (
              <p className={cn(
                "text-xs",
                card.change >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {card.change >= 0 ? '+' : ''}{formatPercentage(card.change)}
                {' '}from last period
              </p>
            )}
            {card.subtitle && (
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Cash Flow Chart Component
const CashFlowChart: React.FC<{
  data: AnalyticsData['cashFlow'];
  isMobile: boolean;
}> = ({ data, isMobile }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Flow</CardTitle>
        <CardDescription>
          Income vs expenses over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
              className="text-xs"
            />
            <YAxis
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              className="text-xs"
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelFormatter={(label) => format(new Date(label), 'PPP')}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              stackId="1"
              stroke={CHART_COLORS.secondary}
              fill={CHART_COLORS.secondary}
              fillOpacity={0.6}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stackId="2"
              stroke={CHART_COLORS.quaternary}
              fill={CHART_COLORS.quaternary}
              fillOpacity={0.6}
            />
            <Line
              type="monotone"
              dataKey="balance"
              stroke={CHART_COLORS.primary}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Category Breakdown Component
const CategoryBreakdown: React.FC<{
  data: AnalyticsData['categoryBreakdown'];
  isMobile: boolean;
}> = ({ data, isMobile }) => {
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>
              Where your money goes
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewType(viewType === 'pie' ? 'bar' : 'pie')}
          >
            <BarChart3 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {viewType === 'pie' ? (
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} ${percentage}%`}
                outerRadius={isMobile ? 80 : 120}
                fill="#8884d8"
                dataKey="amount"
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CATEGORY_COLORS[entry.category] || CHART_COLORS.neutral}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 350}>
            <BarChart data={data} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
              <YAxis dataKey="category" type="category" width={80} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount">
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={CATEGORY_COLORS[entry.category] || CHART_COLORS.neutral}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

// Goals Progress Component
const GoalsProgress: React.FC<{
  goals: AnalyticsData['goals'];
  isMobile: boolean;
}> = ({ goals, isMobile }) => {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Goals Progress</CardTitle>
            <CardDescription>
              Track your financial goals
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/goals')}
          >
            View all
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.slice(0, isMobile ? 3 : 5).map((goal) => (
          <div key={goal.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Target className={cn(
                  "h-4 w-4",
                  goal.onTrack ? "text-green-600" : "text-amber-600"
                )} />
                <span className="font-medium text-sm">{goal.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {formatPercentage(goal.progress)}
              </span>
            </div>
            <Progress value={goal.progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}</span>
              <span>{goal.daysRemaining} days left</span>
            </div>
            {!goal.onTrack && (
              <p className="text-xs text-amber-600">
                Need {formatCurrency(goal.monthlyRequired)}/month to reach goal
              </p>
            )}
          </div>
        ))}
        {goals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active goals</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.push('/goals/new')}
            >
              Create a goal
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Budget Status Component
const BudgetStatus: React.FC<{
  budgets: AnalyticsData['budgets'];
  isMobile: boolean;
}> = ({ budgets, isMobile }) => {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Budget Status</CardTitle>
            <CardDescription>
              Current period spending
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/budgets')}
          >
            View all
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.slice(0, isMobile ? 3 : 5).map((budget) => (
          <div key={budget.id} className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">{budget.name}</span>
              <span className={cn(
                "text-sm font-medium",
                budget.percentage > 100 ? "text-red-600" : 
                budget.percentage > 80 ? "text-amber-600" : "text-green-600"
              )}>
                {formatPercentage(budget.percentage)}
              </span>
            </div>
            <Progress 
              value={Math.min(budget.percentage, 100)} 
              className={cn(
                "h-2",
                budget.percentage > 100 && "bg-red-100"
              )}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(budget.spent)} of {formatCurrency(budget.limit)}</span>
              <span>{budget.period}</span>
            </div>
            {budget.percentage > 80 && (
              <Alert className="py-2">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-xs">
                  {budget.percentage > 100 
                    ? `Over budget by ${formatCurrency(Math.abs(budget.remaining))}`
                    : `Only ${formatCurrency(budget.remaining)} remaining`
                  }
                </AlertDescription>
              </Alert>
            )}
          </div>
        ))}
        {budgets.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Wallet className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No active budgets</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => router.push('/budgets/new')}
            >
              Create a budget
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Spending Patterns Component
const SpendingPatterns: React.FC<{
  data: AnalyticsData['spendingPatterns'];
  isMobile: boolean;
}> = ({ data, isMobile }) => {
  const [view, setView] = useState<'weekly' | 'monthly' | 'merchants'>('weekly');

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Spending Patterns</CardTitle>
            <CardDescription>
              Daily average: {formatCurrency(data.dailyAverage)}
            </CardDescription>
          </div>
          <Select value={view} onValueChange={(v) => setView(v as any)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="merchants">Top Merchants</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
          {view === 'weekly' ? (
            <BarChart data={data.weeklyPattern}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : view === 'monthly' ? (
            <LineChart data={data.monthlyPattern}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" />
              <YAxis tickFormatter={(value) => `$${value}`} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Line
                type="monotone"
                dataKey="amount"
                stroke={CHART_COLORS.primary}
                strokeWidth={2}
                dot={{ fill: CHART_COLORS.primary }}
              />
            </LineChart>
          ) : (
            <BarChart data={data.merchantFrequency.slice(0, 10)} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={(value) => `$${value}`} />
              <YAxis dataKey="merchant" type="category" width={100} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey="amount" fill={CHART_COLORS.tertiary} radius={[0, 4, 4, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

// Insights Panel Component
const InsightsPanel: React.FC<{
  insights: AnalyticsData['insights'];
}> = ({ insights }) => {
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'negative':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Insights</CardTitle>
        <CardDescription>
          AI-powered financial recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((insight) => (
          <Alert
            key={insight.id}
            className={cn(
              "py-3",
              insight.type === 'positive' && "border-green-200 bg-green-50",
              insight.type === 'negative' && "border-red-200 bg-red-50",
              insight.type === 'warning' && "border-amber-200 bg-amber-50"
            )}
          >
            <div className="flex gap-3">
              {getInsightIcon(insight.type)}
              <div className="flex-1 space-y-1">
                <h4 className="text-sm font-medium">{insight.title}</h4>
                <p className="text-xs text-muted-foreground">
                  {insight.description}
                </p>
                {insight.impact && (
                  <p className="text-xs font-medium">
                    Potential savings: {formatCurrency(insight.impact)}
                  </p>
                )}
                {insight.action && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => window.location.href = insight.action!.href}
                  >
                    {insight.action.label}
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          </Alert>
        ))}
        {insights.length === 0 && (
          <p className="text-center py-4 text-muted-foreground text-sm">
            No insights available yet. Keep tracking your finances!
          </p>
        )}
      </CardContent>
    </Card>
  );
};

// Tax Summary Component
const TaxSummary: React.FC<{
  data: AnalyticsData['taxSummary'];
  isMobile: boolean;
}> = ({ data, isMobile }) => {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Tax Summary</CardTitle>
            <CardDescription>
              Current tax year overview
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/tax')}
          >
            Full details
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Taxable Income</p>
            <p className="text-2xl font-bold">{formatCurrency(data.taxableIncome)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Deductions</p>
            <p className="text-2xl font-bold">{formatCurrency(data.deductions)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estimated Tax</p>
            <p className="text-2xl font-bold">{formatCurrency(data.estimatedTax)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Tax Rate</p>
            <p className="text-2xl font-bold">
              {formatPercentage(data.estimatedTax / data.taxableIncome * 100)}
            </p>
          </div>
        </div>
        
        {data.categories.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Top Deduction Categories</h4>
            <div className="space-y-2">
              {data.categories.slice(0, 5).map((cat) => (
                <div key={cat.code} className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {cat.category} ({cat.code})
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Loading Component
const AnalyticsLoading: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[350px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;