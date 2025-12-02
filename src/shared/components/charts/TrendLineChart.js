/**
 * Trend Line Chart Component
 * Displays win/loss trends over time
 */

import React from 'react';
import { Line } from 'react-chartjs-2';
import { useTheme } from '../../../context/ThemeContext';
import { getChartColors, mergeChartOptions } from './chartConfig';
import ChartWrapper from './ChartWrapper';

export const TrendLineChart = ({ data, title, subtitle, className = '' }) => {
  const { isDark } = useTheme();
  const colors = getChartColors(isDark);

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: data.label || 'Trend',
        data: data.values,
        borderColor: colors.line,
        backgroundColor: colors.lineBg,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: colors.line,
        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2
      }
    ]
  };

  const options = mergeChartOptions({
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  }, isDark);

  return (
    <ChartWrapper title={title} subtitle={subtitle} className={className}>
      <Line data={chartData} options={options} />
    </ChartWrapper>
  );
};

export default TrendLineChart;
