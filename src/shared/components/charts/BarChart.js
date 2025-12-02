/**
 * Bar Chart Component
 * Displays comparative bar charts (e.g., PPG comparison)
 */

import React from 'react';
import { Bar } from 'react-chartjs-2';
import { getChartColors, mergeChartOptions } from './chartConfig';
import ChartWrapper from './ChartWrapper';

export const BarChart = ({ data, title, subtitle, className = '', horizontal = false }) => {
  const colors = getChartColors();

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: data.label || 'Value',
        data: data.values,
        backgroundColor: colors.barBg,
        borderColor: colors.bar,
        borderWidth: 1,
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };

  const options = mergeChartOptions({
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      [horizontal ? 'x' : 'y']: {
        beginAtZero: true,
        ticks: {
          precision: 1
        }
      }
    }
  });

  return (
    <ChartWrapper title={title} subtitle={subtitle} className={className}>
      <Bar data={chartData} options={options} />
    </ChartWrapper>
  );
};

export default BarChart;
