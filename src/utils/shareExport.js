import * as htmlToImage from 'html-to-image';

/**
 * Exports a DOM element as a PNG image
 * @param {HTMLElement} element - The DOM element to capture
 * @param {Object} options - Export options
 * @param {string} options.filename - The filename for downloaded image
 * @param {number} options.scale - Scale multiplier for higher quality (default: 2)
 * @param {boolean} options.download - Whether to trigger download (default: false)
 * @param {boolean} options.copyToClipboard - Whether to copy to clipboard (default: false)
 * @returns {Promise<{blob: Blob, dataUrl: string}>} The generated image data
 */
export async function exportToPNG(element, options = {}) {
  const {
    filename = 'fantasy-football-card.png',
    scale = 2, // 2x for retina displays
    download = false,
    copyToClipboard = false,
  } = options;

  if (!element) {
    throw new Error('Element is required for PNG export');
  }

  try {
    // Capture the element with html-to-image
    const dataUrl = await htmlToImage.toPng(element, {
      pixelRatio: scale,
      cacheBust: true,
    });

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Download if requested
    if (download) {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    // Copy to clipboard if requested and supported
    if (copyToClipboard && navigator.clipboard && window.ClipboardItem) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        return { blob, dataUrl, clipboardSuccess: true };
      } catch (clipboardError) {
        console.warn('Failed to copy to clipboard:', clipboardError);
        // Fallback: just download instead
        if (!download) {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        return { blob, dataUrl, clipboardSuccess: false, clipboardError: clipboardError.message };
      }
    }

    return { blob, dataUrl, clipboardSuccess: download ? null : false };
  } catch (error) {
    console.error('Error exporting PNG:', error);
    throw new Error(`Failed to export image: ${error.message}`);
  }
}

/**
 * Generate a shareable matchup card filename
 * @param {Object} matchup - The matchup data
 * @param {number} week - Week number
 * @returns {string} Generated filename
 */
export function generateMatchupFilename(matchup, week) {
  const home = matchup.home?.manager_name || 'TBD';
  const away = matchup.away?.manager_name || 'TBD';
  const sanitizedHome = home.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  const sanitizedAway = away.replace(/[^a-z0-9]/gi, '-').toLowerCase();
  return `week-${week}-${sanitizedHome}-vs-${sanitizedAway}.png`;
}

/**
 * Generate a shareable standings filename
 * @param {number} year - Season year
 * @param {number} week - Week number (optional)
 * @returns {string} Generated filename
 */
export function generateStandingsFilename(year, week = null) {
  if (week) {
    return `${year}-standings-week-${week}.png`;
  }
  return `${year}-final-standings.png`;
}

/**
 * Generate a shareable records filename
 * @param {string} managerName - Manager name (optional)
 * @returns {string} Generated filename
 */
export function generateRecordsFilename(managerName = null) {
  if (managerName) {
    const sanitized = managerName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    return `${sanitized}-career-stats.png`;
  }
  return 'league-records.png';
}

/**
 * Generate a shareable playoff simulator filename
 * @param {number} year - Season year
 * @returns {string} Generated filename
 */
export function generatePlayoffSimulatorFilename(year) {
  return `${year}-playoff-simulator.png`;
}

/**
 * Check if clipboard API is supported
 * @returns {boolean} True if clipboard copy is supported
 */
export function isClipboardSupported() {
  return !!(navigator.clipboard && window.ClipboardItem);
}
