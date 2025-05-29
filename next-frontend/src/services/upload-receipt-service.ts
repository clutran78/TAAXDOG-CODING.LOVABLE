import {
  populateFormWithReceiptData,
  showToast,
} from "@/services/helperFunction";
import { compressImage } from "@/services/ui-helper-functions";

export const handleUploadFromActiveTab = async (
  activeTab: string | undefined,
  receiptFileInput: HTMLInputElement | null,
  receiptUrlInput: HTMLInputElement | null,
  photoCanvas: HTMLCanvasElement | null,
  setLoading: (loading: boolean) => void
) => {
  setLoading(true);
  try {
    if (activeTab === "local-tab") {
      if (!receiptFileInput?.files?.length) {
        showToast("Please select a file to upload.", "primary");
        return;
      }
      await handleReceiptUpload(receiptFileInput.files[0]);
    } else if (activeTab === "url-tab") {
      const url = receiptUrlInput?.value.trim();
      if (!url) {
        showToast("Please paste a receipt URL.", "primary");
        return;
      }
      const proxyUrl = "https://cors-anywhere.herokuapp.com/";
      const fullUrl = new URL(url.startsWith("http") ? url : `https://${url}`);
      showToast("Fetching image from URL...", "primary");

      const response = await fetch(`${proxyUrl}${fullUrl.toString()}`);
      if (!response.ok) {
        throw new Error(`Something went wrong`);
      }
      const blob = await response.blob();
      const type = blob.type || "image/jpeg";
      const ext = type.split("/")[1] || "jpg";
      const file = new File([blob], `url-upload.${ext}`, { type });
      await handleReceiptUpload(file);
    } else if (activeTab === "camera-tab") {
      if (!photoCanvas) return;
      photoCanvas.toBlob(async (blob) => {
        if (!blob) {
          showToast("No photo captured.", "primary");
          return;
        }
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        await handleReceiptUpload(file);
      }, "image/jpeg");
    }
  } catch (error: any) {
    showToast(`Upload failed: ${error.message}`, "danger");
    console.error("Error during upload:", error);
  } finally {
    setLoading(false);
  }
};

export const handleReceiptUpload = async (file: File | null): Promise<void> => {
  if (!file) {
    showToast("No file selected!", "primary");
    return;
  }

  showToast("Compressing image...", "primary");

  try {
    const compressedFile = await compressImage(file);

    if (compressedFile.size > 10 * 1024 * 1024) {
      showToast("File too large. Max 10MB allowed.", "danger");
      return;
    }

    const formData = new FormData();
    formData.append("receipt", compressedFile);

    showToast("Uploading receipt...", "primary");

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/receipts/upload/gemini`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || `HTTP error! status: ${response.status}`);
    }

    showToast("Extraction Successful!", "success");
    populateFormWithReceiptData(result.data);

    const formElement = document.getElementById("receipt-review-form");
    if (formElement) formElement.style.display = "block";

    const { default: Modal } = await import("bootstrap/js/dist/modal");
    const modalEl = document.getElementById("receipt-upload-section");
    if (modalEl) {
      const modalInstance =
        Modal.getInstance(modalEl) || Modal.getOrCreateInstance(modalEl);
      modalInstance.hide();
    }
  } catch (error: any) {
    showToast(`Upload failed: ${error.message}`, "danger");
    console.error("Receipt upload/extraction failed:", error);
  }
};
