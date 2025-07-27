import React, { useState, useCallback, useRef } from 'react';
import { useDropzone, FileRejection, FileError } from 'react-dropzone';

interface ReceiptUploaderProps {
  onUpload: (files: File[]) => Promise<void>;
  maxFiles?: number;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  className?: string;
}

const DEFAULT_ACCEPTED_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
];

export const ReceiptUploader: React.FC<ReceiptUploaderProps> = ({
  onUpload,
  maxFiles = 10,
  maxSizeMB = 10,
  acceptedFormats = DEFAULT_ACCEPTED_FORMATS,
  className = '',
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      setErrors([]);
      setSuccessCount(0);
      setUploadProgress({});

      // Initialize progress for all files
      const initialProgress: { [key: string]: number } = {};
      acceptedFiles.forEach((file) => {
        initialProgress[file.name] = 0;
      });
      setUploadProgress(initialProgress);

      try {
        // Process files one by one for better progress tracking
        for (let i = 0; i < acceptedFiles.length; i++) {
          const file = acceptedFiles[i];

          try {
            // Simulate progress (in real app, this would be from XMLHttpRequest)
            setUploadProgress((prev) => ({ ...prev, [file.name]: 50 }));

            await onUpload([file]);

            setUploadProgress((prev) => ({ ...prev, [file.name]: 100 }));
            setSuccessCount((prev) => prev + 1);
          } catch (error) {
            setErrors((prev) => [...prev, `Failed to upload ${file.name}`]);
            setUploadProgress((prev) => ({ ...prev, [file.name]: -1 }));
          }
        }
      } finally {
        setUploading(false);

        // Clear progress after 3 seconds
        setTimeout(() => {
          setUploadProgress({});
          setSuccessCount(0);
        }, 3000);
      }
    },
    [onUpload],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      const errors: string[] = [];

      // Handle rejected files
      rejectedFiles.forEach((rejection) => {
        const { file, errors: fileErrors } = rejection;
        fileErrors.forEach((error: FileError) => {
          if (error.code === 'file-too-large') {
            errors.push(`${file.name} is too large (max ${maxSizeMB}MB)`);
          } else if (error.code === 'file-invalid-type') {
            errors.push(`${file.name} is not a supported format`);
          } else {
            errors.push(`${file.name}: ${error.message}`);
          }
        });
      });

      setErrors(errors);

      if (acceptedFiles.length > 0) {
        processFiles(acceptedFiles);
      }
    },
    [maxSizeMB, processFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats.reduce(
      (acc, format) => {
        acc[format] = [];
        return acc;
      },
      {} as Record<string, string[]>,
    ),
    maxSize: maxSizeMB * 1024 * 1024,
    maxFiles,
    disabled: uploading,
  });

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={className}>
      {/* Dropzone Area */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        {/* Icon */}
        <div className="mb-4 flex justify-center">
          {isDragActive ? (
            <svg
              className="w-16 h-16 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          ) : (
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>

        {/* Text */}
        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900">
            {isDragActive ? 'Drop receipts here' : 'Drag & drop receipts'}
          </p>
          <p className="text-sm text-gray-600">
            or{' '}
            <button
              type="button"
              onClick={handleButtonClick}
              className="text-blue-600 hover:text-blue-700 font-medium"
              disabled={uploading}
            >
              browse files
            </button>
          </p>
          <p className="text-xs text-gray-500">Supports JPG, PNG, HEIC, PDF up to {maxSizeMB}MB</p>
        </div>

        {/* Hidden file input for button click */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={maxFiles > 1}
          accept={acceptedFormats.join(',')}
          onChange={(e) => {
            if (e.target.files) {
              processFiles(Array.from(e.target.files));
            }
          }}
          className="hidden"
        />
      </div>

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="mt-4 space-y-2">
          {Object.entries(uploadProgress).map(([filename, progress]) => (
            <div
              key={filename}
              className="bg-white p-3 rounded-lg shadow-sm border"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 truncate flex-1 mr-2">
                  {filename}
                </span>
                <span className="text-sm text-gray-500">
                  {progress === -1 ? 'Failed' : progress === 100 ? 'Complete' : `${progress}%`}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    progress === -1
                      ? 'bg-red-600'
                      : progress === 100
                        ? 'bg-green-600'
                        : 'bg-blue-600'
                  }`}
                  style={{ width: `${Math.max(progress, 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {successCount > 0 && !uploading && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-green-600 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm text-green-800">
              Successfully uploaded {successCount} receipt{successCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <p
                  key={index}
                  className="text-sm text-red-800"
                >
                  {error}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-4 text-xs text-gray-500 space-y-1">
        <p>• Take clear photos with good lighting for best results</p>
        <p>• Ensure all text on the receipt is visible</p>
        <p>• Multiple receipts? Upload them all at once!</p>
      </div>
    </div>
  );
};

export default ReceiptUploader;
