import React, { useState } from 'react';
import { Share2, Download, Copy, CheckCircle2 } from 'lucide-react';
import { exportToPNG, isClipboardSupported } from '../../utils/shareExport';

/**
 * ShareButton Component
 *
 * Provides a button to export content as PNG with options to download or copy to clipboard
 *
 * @param {Object} props
 * @param {Function} props.getElement - Function that returns the DOM element to export
 * @param {string} props.filename - Filename for the downloaded image
 * @param {string} props.label - Button label (default: 'Share')
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.showIcon - Whether to show the share icon (default: true)
 * @param {string} props.size - Button size: 'sm', 'md', 'lg' (default: 'md')
 * @param {Function} props.onExportStart - Callback when export starts
 * @param {Function} props.onExportComplete - Callback when export completes
 * @param {Function} props.onExportError - Callback when export fails
 */
export function ShareButton({
  getElement,
  filename,
  label = 'Share',
  className = '',
  showIcon = true,
  size = 'md',
  onExportStart,
  onExportComplete,
  onExportError,
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 20,
  };

  const handleExport = async (action) => {
    setShowMenu(false);

    if (isExporting) return;

    try {
      setIsExporting(true);
      onExportStart?.();

      const element = getElement();
      if (!element) {
        throw new Error('Element not found for export');
      }

      // Find any hidden lineup sections within the element and temporarily show them
      const hiddenLineups = element.querySelectorAll('.hidden');
      const previousClasses = Array.from(hiddenLineups).map(el => el.className);

      // Temporarily remove 'hidden' class for export
      hiddenLineups.forEach(el => {
        el.classList.remove('hidden');
      });

      // Wait a moment for layout to settle
      await new Promise(resolve => setTimeout(resolve, 100));

      const shouldCopy = action === 'copy';
      const shouldDownload = action === 'download';

      const result = await exportToPNG(element, {
        filename,
        download: shouldDownload,
        copyToClipboard: shouldCopy,
        scale: 2,
      });

      // Restore previous classes
      hiddenLineups.forEach((el, index) => {
        el.className = previousClasses[index];
      });

      if (shouldCopy) {
        if (result.clipboardSuccess) {
          setCopySuccess(true);
          setTimeout(() => setCopySuccess(false), 2000);
        } else {
          // Clipboard failed, fallback triggered download
          alert('Copy to clipboard is not supported on this device. The image has been downloaded instead.');
        }
      }

      onExportComplete?.({ action, clipboardSuccess: result.clipboardSuccess });
    } catch (error) {
      console.error('Export failed:', error);
      onExportError?.(error);
      alert(`Failed to ${action === 'copy' ? 'copy' : 'download'} image: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const clipboardSupported = isClipboardSupported();

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={isExporting}
        className={`
          inline-flex items-center gap-2
          ${sizeClasses[size]}
          bg-blue-600 hover:bg-blue-700
          text-white font-medium rounded-lg
          transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${className}
        `}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={showMenu}
      >
        {showIcon && (
          isExporting ? (
            <div className="animate-spin rounded-full border-2 border-white border-t-transparent" style={{ width: iconSizes[size], height: iconSizes[size] }} />
          ) : copySuccess ? (
            <CheckCircle2 size={iconSizes[size]} />
          ) : (
            <Share2 size={iconSizes[size]} />
          )
        )}
        {isExporting ? 'Exporting...' : copySuccess ? 'Copied!' : label}
      </button>

      {showMenu && !isExporting && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu */}
          <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
            <div className="py-1" role="menu" aria-orientation="vertical">
              <button
                onClick={() => handleExport('download')}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                role="menuitem"
              >
                <Download size={16} />
                Download PNG
              </button>

              {clipboardSupported && (
                <button
                  onClick={() => handleExport('copy')}
                  className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  role="menuitem"
                >
                  <Copy size={16} />
                  Copy to Clipboard
                </button>
              )}

              {!clipboardSupported && (
                <div className="px-4 py-2 text-xs text-gray-500 italic">
                  Clipboard not supported in this browser
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ShareButton;
