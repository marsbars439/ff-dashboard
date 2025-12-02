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

  // Support conditional coloring based on positive/negative values or baseline
  const getBackgroundColors = () => {
    if (data.conditionalColor) {
      const baseline = data.baseline !== undefined ? data.baseline : 0;
      return data.values.map(value =>
        value >= baseline ? colors.success : colors.danger
      );
    }
    return colors.barBg;
  };

  const getBorderColors = () => {
    if (data.conditionalColor) {
      const baseline = data.baseline !== undefined ? data.baseline : 0;
      return data.values.map(value =>
        value >= baseline ? colors.success : colors.danger
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

  const axisKey = horizontal ? 'x' : 'y';
  const baseOptions = {
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      [axisKey]: {
        beginAtZero: data.minValue === undefined ? true : false,
        min: data.minValue,
        ticks: {
          precision: 1
        }
      }
    }
  };

  // Add baseline grid line if specified
  if (data.baseline !== undefined) {
    baseOptions.scales[axisKey].grid = {
      color: (context) => {
        if (context.tick.value === data.baseline) {
          return 'rgba(226, 232, 240, 0.5)'; // Highlighted baseline
        }
        return 'rgba(148, 163, 184, 0.15)'; // Normal grid
      },
      lineWidth: (context) => {
        if (context.tick.value === data.baseline) {
          return 2; // Thicker baseline
        }
        return 1;
      }
    };
  }

  const options = mergeChartOptions(baseOptions);

  return (
    <ChartWrapper title={title} subtitle={subtitle} className={className}>
      <Bar data={chartData} options={options} />
    </ChartWrapper>
  );
};

export default BarChart;
