/**
 * Pie Chart Component
 * Displays distribution data (e.g., playoff finishes)
 */

import React from 'react';
import { Pie } from 'react-chartjs-2';
import { getChartColors, mergeChartOptions } from './chartConfig';
import ChartWrapper from './ChartWrapper';

export const PieChart = ({ data, title, subtitle, className = '' }) => {
  const colors = getChartColors();

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        data: data.values,
        backgroundColor: colors.pie,
        borderColor: '#0f172a',
        borderWidth: 2,
        hoverOffset: 8
      }
    ]
  };

  const options = mergeChartOptions({
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 16,
          boxWidth: 12,
          boxHeight: 12
        }
      }
    },
    scales: undefined // Remove scales for pie chart
  });

  return (
    <ChartWrapper title={title} subtitle={subtitle} className={className}>
      <div style={{ maxWidth: '400px', margin: '0 auto' }}>
        <Pie data={chartData} options={options} />
      </div>
    </ChartWrapper>
  );
};

export default PieChart;
