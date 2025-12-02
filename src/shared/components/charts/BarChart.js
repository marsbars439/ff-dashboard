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

  // Support conditional coloring based on positive/negative values
  const getBackgroundColors = () => {
    if (data.conditionalColor) {
      return data.values.map(value =>
        value >= 0 ? colors.success : colors.danger
      );
    }
    return colors.barBg;
  };

  const getBorderColors = () => {
    if (data.conditionalColor) {
      return data.values.map(value =>
        value >= 0 ? colors.success : colors.danger
      );
    }
    return colors.bar;
  };

  const chartData = {
    labels: data.labels,
    datasets: [
      {
        label: data.label || 'Value',
        data: data.values,
        backgroundColor: getBackgroundColors(),
        borderColor: getBorderColors(),
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
        beginAtZero: data.minValue === undefined ? true : false,
        min: data.minValue,
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
