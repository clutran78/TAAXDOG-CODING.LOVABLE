'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface MobileChartProps {
  period: 'week' | 'month' | 'year';
  type?: 'area' | 'bar' | 'pie';
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const MobileChart: React.FC<MobileChartProps> = ({ period, type = 'area' }) => {
  const data = useMemo(() => {
    switch (period) {
      case 'week':
        return [
          { name: 'Mon', income: 400, expenses: 240 },
          { name: 'Tue', income: 300, expenses: 139 },
          { name: 'Wed', income: 200, expenses: 380 },
          { name: 'Thu', income: 278, expenses: 390 },
          { name: 'Fri', income: 189, expenses: 480 },
          { name: 'Sat', income: 239, expenses: 380 },
          { name: 'Sun', income: 349, expenses: 430 }
        ];
      case 'month':
        return [
          { name: 'Week 1', income: 2400, expenses: 1398 },
          { name: 'Week 2', income: 2210, expenses: 2000 },
          { name: 'Week 3', income: 2290, expenses: 2181 },
          { name: 'Week 4', income: 2000, expenses: 2500 }
        ];
      case 'year':
        return [
          { name: 'Jan', income: 4000, expenses: 2400 },
          { name: 'Feb', income: 3000, expenses: 1398 },
          { name: 'Mar', income: 2000, expenses: 3800 },
          { name: 'Apr', income: 2780, expenses: 3908 },
          { name: 'May', income: 1890, expenses: 4800 },
          { name: 'Jun', income: 2390, expenses: 3800 },
          { name: 'Jul', income: 3490, expenses: 4300 },
          { name: 'Aug', income: 3490, expenses: 4300 },
          { name: 'Sep', income: 3490, expenses: 4300 },
          { name: 'Oct', income: 3490, expenses: 4300 },
          { name: 'Nov', income: 3490, expenses: 4300 },
          { name: 'Dec', income: 3490, expenses: 4300 }
        ];
    }
  }, [period]);

  const pieData = [
    { name: 'Housing', value: 35 },
    { name: 'Food', value: 20 },
    { name: 'Transport', value: 15 },
    { name: 'Utilities', value: 10 },
    { name: 'Other', value: 20 }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 shadow-lg rounded-lg border border-gray-200">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className={`text-xs ${entry.name === 'income' ? 'text-green-600' : 'text-red-600'}`}>
              {entry.name}: ${entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={CustomLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === 'bar') {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="name" 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis 
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="income"
          stroke="#10B981"
          fillOpacity={1}
          fill="url(#colorIncome)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="expenses"
          stroke="#EF4444"
          fillOpacity={1}
          fill="url(#colorExpenses)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default MobileChart;