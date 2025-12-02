/**
 * Chart.js Configuration
 * Dark theme chart defaults and utilities
 */

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Get chart colors (dark theme only)
 * @returns {Object} Color configuration for charts
 */
export const getChartColors = () => ({
  // Text colors
  text: '#e2e8f0',
  textMuted: 'rgba(226, 232, 240, 0.78)',

  // Grid colors
  grid: 'rgba(148, 163, 184, 0.15)',

  // Data colors
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',

  // Chart-specific colors
  line: '#38bdf8',
  bar: '#6366f1',
  pie: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'],

  // Background colors with transparency
  lineBg: 'rgba(56, 189, 248, 0.1)',
  barBg: 'rgba(99, 102, 241, 0.7)',
});

/**
 * Get default chart options
 * @returns {Object} Chart.js options object
 */
export const getDefaultChartOptions = () => {
  const colors = getChartColors();

  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        labels: {
          color: colors.text,
          font: {
            family: "'Inter', 'Segoe UI', system-ui, sans-serif",
            size: 12
          },
          padding: 12,
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: colors.text,
        bodyColor: colors.textMuted,
        borderColor: colors.grid,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          family: "'Inter', 'Segoe UI', system-ui, sans-serif",
          size: 13,
          weight: 'bold'
        },
        bodyFont: {
          family: "'Inter', 'Segoe UI', system-ui, sans-serif",
          size: 12
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: colors.grid,
          drawBorder: false
        },
        ticks: {
          color: colors.textMuted,
          font: {
            family: "'Inter', 'Segoe UI', system-ui, sans-serif",
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: colors.grid,
          drawBorder: false
        },
        ticks: {
          color: colors.textMuted,
          font: {
            family: "'Inter', 'Segoe UI', system-ui, sans-serif",
            size: 11
          }
        }
      }
    }
  };
};

/**
 * Merge custom options with defaults
 * @param {Object} customOptions - Custom chart options
 * @returns {Object} Merged options
 */
export const mergeChartOptions = (customOptions = {}) => {
  const defaults = getDefaultChartOptions();

  return {
    ...defaults,
    ...customOptions,
    plugins: {
      ...defaults.plugins,
      ...customOptions.plugins
    },
    scales: customOptions.scales || defaults.scales
  };
};
