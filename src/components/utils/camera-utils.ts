export const startCamera = async (
  video: HTMLVideoElement | null,
  showCameraUnavailable: () => void,
  showCameraAvailable: () => void,
) => {
  try {
    if (!video) {
      console.error('Video element is not provided.');
      showCameraUnavailable();
      return;
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasCamera = devices.some((device) => device.kind === 'videoinput');

    if (!hasCamera) {
      showCameraUnavailable();
      return;
    }
    showCameraAvailable();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
    });

    video.srcObject = stream;
    await video.play();
  } catch (err) {
    console.error('Camera access error:', err);
    showCameraUnavailable();
  }
};

export const capturePhoto = (
  video: HTMLVideoElement | null,
  canvas: HTMLCanvasElement | null,
  photoPreview: HTMLImageElement | null,
  validateForm: () => void,
) => {
  if (!video || !canvas || !photoPreview) {
    console.error('Video, canvas, or photo preview element is not provided.');
    return;
  }
  const context = canvas.getContext('2d');
  if (!context) return;

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL('image/jpeg');

  photoPreview.src = dataURL;
  const previewWrapper = document.getElementById('photo-preview-wrapper');
  if (previewWrapper) previewWrapper.classList.remove('d-none');

  photoPreview.style.display = 'block';
  validateForm();
};

export const removeCapturedPhoto = (
  photoPreview: HTMLImageElement | null,
  validateForm: () => void,
) => {
  const previewWrapper = document.getElementById('photo-preview-wrapper');
  if (photoPreview && previewWrapper) {
    photoPreview.src = '';
    previewWrapper.classList.add('d-none');
    validateForm();
  }
};
