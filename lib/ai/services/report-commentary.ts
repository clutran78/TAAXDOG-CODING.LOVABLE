import { AIService } from '../ai-service';
import { AIOperationType } from '../types';

export class ReportCommentaryService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  async generateTaxReturnCommentary(
    userId: string,
    taxReturnData: {
      year: string;
      income: {
        salary?: number;
        business?: number;
        investments?: number;
        rental?: number;
        other?: number;
      };
      deductions: {
        workRelated?: number;
        selfEducation?: number;
        donations?: number;
        investment?: number;
        rental?: number;
        other?: number;
      };
      taxPayable: number;
      refundOrOwing: number;
      previousYears?: Array<{
        year: string;
        totalIncome: number;
        totalDeductions: number;
        taxPayable: number;
      }>;
    },
  ): Promise<{
    executiveSummary: string;
    incomeAnalysis: string;
    deductionAnalysis: string;
    taxPositionCommentary: string;
    yearOverYearAnalysis?: string;
    recommendations: string[];
  }> {
    const prompt = `Generate professional tax return commentary for an Australian taxpayer:

Tax Return Data: ${JSON.stringify(taxReturnData)}

Create commentary that:
1. Summarizes the tax position in plain English
2. Highlights key income sources and their tax implications
3. Reviews deduction claims and their reasonableness
4. Compares to previous years (if data available)
5. Identifies optimization opportunities for next year
6. Uses Australian tax terminology and ATO references

Tone: Professional but accessible, suitable for client communication

Structure the response as:
{
  "executiveSummary": "2-3 sentence overview",
  "incomeAnalysis": "paragraph analyzing income sources",
  "deductionAnalysis": "paragraph reviewing deductions",
  "taxPositionCommentary": "explanation of tax outcome",
  "yearOverYearAnalysis": "comparison to previous years if applicable",
  "recommendations": ["future tax planning recommendations"]
}`;

    const response = await this.aiService.sendMessage(
      [
        {
          role: 'system',
          content:
            'You are a professional tax advisor creating client-friendly tax return summaries for Australian taxpayers.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      userId,
      AIOperationType.REPORT_COMMENTARY,
    );

    return JSON.parse(response.content);
  }

  async generateFinancialReportNarrative(
    userId: string,
    reportType: 'profit_loss' | 'balance_sheet' | 'cash_flow',
    reportData: {
      period: string;
      figures: Record<string, any>;
      comparativePeriod?: Record<string, any>;
      industry?: string;
    },
  ): Promise<{
    narrative: string;
    keyHighlights: string[];
    concerns: string[];
    recommendations: string[];
  }> {
    const reportTypeNames = {
      profit_loss: 'Profit & Loss Statement',
      balance_sheet: 'Balance Sheet',
      cash_flow: 'Cash Flow Statement',
    };

    const prompt = `Generate professional commentary for a ${reportTypeNames[reportType]}:

Report Data: ${JSON.stringify(reportData)}

Create a narrative that:
1. Explains the financial position in clear, non-technical language
2. Highlights significant trends or changes
3. Compares to previous period (if available)
4. Identifies potential concerns or risks
5. Provides actionable recommendations
6. Considers Australian business context and regulations

${reportData.industry ? `Industry: ${reportData.industry} (use Australian industry benchmarks)` : ''}

Structure as:
{
  "narrative": "2-3 paragraph overview of financial position",
  "keyHighlights": ["positive findings or achievements"],
  "concerns": ["areas requiring attention"],
  "recommendations": ["specific actions to improve performance"]
}`;

    const response = await this.aiService.sendMessage(
      [
        {
          role: 'system',
          content:
            'You are a financial analyst creating clear, insightful reports for Australian business owners.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      userId,
      AIOperationType.REPORT_COMMENTARY,
    );

    return JSON.parse(response.content);
  }

  async generateInvestmentPerformanceCommentary(
    userId: string,
    portfolioData: {
      holdings: Array<{
        asset: string;
        value: number;
        costBase: number;
        income: number;
      }>;
      totalValue: number;
      totalCostBase: number;
      totalIncome: number;
      period: string;
      assetAllocation: Record<string, number>;
    },
  ): Promise<{
    performanceSummary: string;
    assetAllocationCommentary: string;
    incomeAnalysis: string;
    taxImplications: string;
    recommendations: string[];
  }> {
    const prompt = `Generate investment portfolio commentary for an Australian investor:

Portfolio Data: ${JSON.stringify(portfolioData)}

Create commentary covering:
1. Overall performance (capital growth + income)
2. Asset allocation appropriateness
3. Income generation and franking credits
4. Tax implications (CGT, dividend imputation)
5. Rebalancing recommendations
6. Risk assessment

Consider Australian tax rules:
- 50% CGT discount for assets held >12 months
- Franking credit refunds
- Tax-effective investment structures

Structure as:
{
  "performanceSummary": "overview of returns and performance",
  "assetAllocationCommentary": "analysis of portfolio composition",
  "incomeAnalysis": "dividend and distribution analysis",
  "taxImplications": "CGT and income tax considerations",
  "recommendations": ["specific portfolio adjustments"]
}`;

    const response = await this.aiService.sendMessage(
      [
        {
          role: 'system',
          content:
            'You are an investment advisor specializing in Australian tax-effective portfolio management.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      userId,
      AIOperationType.REPORT_COMMENTARY,
    );

    return JSON.parse(response.content);
  }

  async generateCustomReport(
    userId: string,
    reportTitle: string,
    data: any,
    requirements: {
      tone?: 'professional' | 'casual' | 'technical';
      length?: 'brief' | 'detailed';
      focus?: string[];
      includeRecommendations?: boolean;
    } = {},
  ): Promise<{
    title: string;
    sections: Array<{
      heading: string;
      content: string;
    }>;
    recommendations?: string[];
  }> {
    const prompt = `Generate a custom financial report:

Title: ${reportTitle}
Data: ${JSON.stringify(data)}
Requirements: ${JSON.stringify(requirements)}

Create a well-structured report that:
1. Addresses the specific report purpose
2. Uses appropriate tone and detail level
3. Focuses on specified areas
4. Provides Australian context where relevant
5. Includes actionable insights

Format as:
{
  "title": "formatted report title",
  "sections": [
    {
      "heading": "section title",
      "content": "section narrative"
    }
  ],
  "recommendations": ["if requested"]
}`;

    const response = await this.aiService.sendMessage(
      [
        {
          role: 'system',
          content:
            'You are a versatile financial report writer with expertise in Australian finance and taxation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      userId,
      AIOperationType.REPORT_COMMENTARY,
    );

    return JSON.parse(response.content);
  }

  async generateBenchmarkComparison(
    userId: string,
    businessMetrics: {
      industry: string;
      revenue: number;
      expenses: Record<string, number>;
      employees?: number;
      location?: string;
    },
  ): Promise<{
    summary: string;
    benchmarks: Array<{
      metric: string;
      yourValue: number;
      industryAverage: number;
      percentile: number;
      commentary: string;
    }>;
    strengths: string[];
    improvements: string[];
  }> {
    const prompt = `Compare business metrics to Australian industry benchmarks:

Business Metrics: ${JSON.stringify(businessMetrics)}

Provide:
1. Comparison to Australian ${businessMetrics.industry} industry averages
2. Expense ratios vs benchmarks
3. Efficiency metrics
4. Regional considerations (if location provided)
5. ATO small business benchmarks where relevant

Use latest available Australian industry data.

Structure as:
{
  "summary": "overall position vs industry",
  "benchmarks": [
    {
      "metric": "metric name",
      "yourValue": business value,
      "industryAverage": benchmark value,
      "percentile": estimated percentile (0-100),
      "commentary": "interpretation"
    }
  ],
  "strengths": ["areas outperforming industry"],
  "improvements": ["areas for improvement"]
}`;

    const response = await this.aiService.sendMessage(
      [
        {
          role: 'system',
          content:
            'You are a business analyst with deep knowledge of Australian industry benchmarks and ATO business performance data.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      userId,
      AIOperationType.REPORT_COMMENTARY,
    );

    return JSON.parse(response.content);
  }
}
