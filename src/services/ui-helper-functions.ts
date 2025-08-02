export const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      if (!e.target?.result) return reject('File load error');

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 1000;
        const scaleFactor = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scaleFactor;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressed = new File([blob], file.name, {
                type: file.type,
              });
              resolve(compressed);
            } else {
              reject('Compression failed');
            }
          },
          file.type,
          0.7, // quality (70%)
        );
      };

      img.onerror = () => reject('Image load error');
      img.src = e.target.result as string;
    };

    reader.readAsDataURL(file);
  });
};

export const resetUploadFields = () => {
  const fileInput = document.getElementById('receipt-file') as HTMLInputElement;
  if (fileInput) fileInput.value = '';

  const urlInput = document.getElementById('receipt-url') as HTMLInputElement;
  if (urlInput) urlInput.value = '';

  const photoPreview = document.getElementById('photo-preview') as HTMLImageElement;
  const photoWrapper = document.getElementById('photo-preview-wrapper');
  if (photoPreview && photoWrapper) {
    photoPreview.src = '';
    photoWrapper.classList.add('d-none');
  }

  const canvas = document.getElementById('photo-canvas') as HTMLCanvasElement;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }
};

export const validateForm = () => {
  const activeTab = document.querySelector('#uploadTab .nav-link.active')?.id;
  const submitBtn = document.querySelector(
    '#receipt-upload-section button[type="submit"]',
  ) as HTMLButtonElement | null;

  const receiptFileInput = document.getElementById('receipt-file') as HTMLInputElement | null;
  const receiptUrlInput = document.getElementById('receipt-url') as HTMLInputElement | null;
  const capturedPhoto = !!document.getElementById('photo-preview')?.getAttribute('src');

  if (!submitBtn) return;

  if (activeTab === 'local-tab') {
    submitBtn.disabled = !receiptFileInput?.files?.length;
  } else if (activeTab === 'url-tab') {
    submitBtn.disabled = !(receiptUrlInput && receiptUrlInput.value.trim().length > 0);
  } else if (activeTab === 'camera-tab') {
    submitBtn.disabled = !capturedPhoto;
  }
};
