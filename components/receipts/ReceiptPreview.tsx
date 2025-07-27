import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface ReceiptPreviewProps {
  imageUrl: string;
  alt?: string;
  onClose?: () => void;
  onRotate?: (rotation: number) => void;
  onCrop?: (cropData: CropData) => void;
  className?: string;
  allowZoom?: boolean;
  allowRotate?: boolean;
  allowCrop?: boolean;
  showMetadata?: boolean;
  metadata?: ReceiptMetadata;
}

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ReceiptMetadata {
  fileName?: string;
  fileSize?: number;
  uploadDate?: string;
  dimensions?: { width: number; height: number };
  processingStatus?: string;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  imageUrl,
  alt = 'Receipt preview',
  onClose,
  onRotate,
  onCrop,
  className = '',
  allowZoom = true,
  allowRotate = true,
  allowCrop = false,
  showMetadata = false,
  metadata,
}) => {
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Handle rotation
  const handleRotate = (direction: 'left' | 'right') => {
    const newRotation = direction === 'left' ? rotation - 90 : rotation + 90;
    setRotation(newRotation);
    onRotate?.(newRotation);
  };

  // Handle zoom
  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.5, Math.min(zoom + delta, 3));
    setZoom(newZoom);
  };

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (!allowZoom) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoom(delta);
  };

  // Handle crop
  const handleCropMouseDown = (e: React.MouseEvent) => {
    if (!cropMode || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCropStart({ x, y });
    setCropEnd({ x, y });
  };

  const handleCropMouseMove = (e: React.MouseEvent) => {
    if (!cropStart || !imageContainerRef.current) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCropEnd({ x, y });
  };

  const handleCropMouseUp = () => {
    if (!cropStart || !cropEnd) return;

    const cropData: CropData = {
      x: Math.min(cropStart.x, cropEnd.x),
      y: Math.min(cropStart.y, cropEnd.y),
      width: Math.abs(cropEnd.x - cropStart.x),
      height: Math.abs(cropEnd.y - cropStart.y),
    };

    onCrop?.(cropData);
    setCropMode(false);
    setCropStart(null);
    setCropEnd(null);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      imageContainerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        toggleFullscreen();
      } else if (e.key === '+' && allowZoom) {
        handleZoom(0.1);
      } else if (e.key === '-' && allowZoom) {
        handleZoom(-0.1);
      } else if (e.key === 'r' && allowRotate) {
        handleRotate('right');
      } else if (e.key === 'l' && allowRotate) {
        handleRotate('left');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen, allowZoom, allowRotate, zoom, rotation]);

  if (imageError) {
    return (
      <div className={`flex items-center justify-center p-8 bg-gray-100 rounded-lg ${className}`}>
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-600">Failed to load receipt image</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-blue-600 hover:text-blue-700"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {allowZoom && (
              <>
                <button
                  onClick={() => handleZoom(-0.1)}
                  className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                  title="Zoom out (-)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                    />
                  </svg>
                </button>
                <span className="text-white text-sm px-2">{Math.round(zoom * 100)}%</span>
                <button
                  onClick={() => handleZoom(0.1)}
                  className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                  title="Zoom in (+)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                    />
                  </svg>
                </button>
              </>
            )}

            {allowRotate && (
              <>
                <div className="w-px h-6 bg-white/30 mx-2" />
                <button
                  onClick={() => handleRotate('left')}
                  className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                  title="Rotate left (L)"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleRotate('right')}
                  className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                  title="Rotate right (R)"
                >
                  <svg
                    className="w-5 h-5 transform scale-x-[-1]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </>
            )}

            {allowCrop && (
              <>
                <div className="w-px h-6 bg-white/30 mx-2" />
                <button
                  onClick={() => setCropMode(!cropMode)}
                  className={`p-2 text-white rounded transition-colors ${
                    cropMode ? 'bg-white/30' : 'hover:bg-white/20'
                  }`}
                  title="Crop"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3m15-6h3m-3 0a3 3 0 01-3 3m3-3a3 3 0 00-3-3m-12 3v10a3 3 0 003 3h10a3 3 0 003-3v-3"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="p-2 text-white hover:bg-white/20 rounded transition-colors"
              title="Fullscreen"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded transition-colors"
                title="Close"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={imageContainerRef}
        className="relative flex items-center justify-center overflow-hidden"
        style={{ height: isFullscreen ? '100vh' : '600px' }}
        onWheel={handleWheel}
        onMouseDown={handleCropMouseDown}
        onMouseMove={handleCropMouseMove}
        onMouseUp={handleCropMouseUp}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="spinner-lg mb-4" />
              <p className="text-white">Loading receipt...</p>
            </div>
          </div>
        )}

        <div
          className="relative transition-transform duration-200"
          style={{
            transform: `rotate(${rotation}deg) scale(${zoom})`,
            cursor: cropMode ? 'crosshair' : zoom > 1 ? 'move' : 'default',
          }}
        >
          <Image
            src={imageUrl}
            alt={alt}
            width={800}
            height={1000}
            className="max-w-full max-h-full object-contain"
            onLoadingComplete={() => setIsLoading(false)}
            onError={() => setImageError(true)}
            priority
          />
        </div>

        {/* Crop Overlay */}
        {cropMode && cropStart && cropEnd && (
          <div
            className="absolute border-2 border-blue-500 bg-blue-500/20"
            style={{
              left: Math.min(cropStart.x, cropEnd.x),
              top: Math.min(cropStart.y, cropEnd.y),
              width: Math.abs(cropEnd.x - cropStart.x),
              height: Math.abs(cropEnd.y - cropStart.y),
            }}
          />
        )}
      </div>

      {/* Metadata Panel */}
      {showMetadata && metadata && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <div className="text-white text-sm space-y-1">
            {metadata.fileName && (
              <p>
                <span className="text-gray-400">File:</span> {metadata.fileName}
              </p>
            )}
            {metadata.fileSize && (
              <p>
                <span className="text-gray-400">Size:</span> {formatFileSize(metadata.fileSize)}
              </p>
            )}
            {metadata.dimensions && (
              <p>
                <span className="text-gray-400">Dimensions:</span> {metadata.dimensions.width} ×{' '}
                {metadata.dimensions.height}
              </p>
            )}
            {metadata.uploadDate && (
              <p>
                <span className="text-gray-400">Uploaded:</span>{' '}
                {new Date(metadata.uploadDate).toLocaleString('en-AU')}
              </p>
            )}
            {metadata.processingStatus && (
              <p>
                <span className="text-gray-400">Status:</span> {metadata.processingStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Help Text */}
      {!isLoading && (
        <div className="absolute bottom-4 right-4 text-white/50 text-xs">
          {allowZoom && <p>Scroll to zoom • +/- keys</p>}
          {allowRotate && <p>R/L keys to rotate</p>}
        </div>
      )}
    </div>
  );
};

export default ReceiptPreview;
