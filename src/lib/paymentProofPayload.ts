export interface PaymentProofPayload {
  base64: string;
  name: string;
  type: string;
  size: number;
}

export interface PreparedPaymentProof {
  blob: Blob;
  name: string;
  type: string;
  size: number;
  wasOptimized: boolean;
}

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_SAFE_BYTES = 1.8 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2000;

const changeFileExtension = (fileName: string, extension: string) =>
  fileName.replace(/\.[^.]+$/, "") + `.${extension}`;

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Unable to optimize the selected image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });

export const preparePaymentProof = async (file: File): Promise<PreparedPaymentProof> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Please upload a file smaller than 5MB.");
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return {
      blob: file,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      wasOptimized: false,
    };
  }

  if (file.size <= MAX_REQUEST_SAFE_BYTES) {
    return {
      blob: file,
      name: file.name,
      type: file.type,
      size: file.size,
      wasOptimized: false,
    };
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to optimize the selected image.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42]) {
    const optimizedBlob = await canvasToBlob(canvas, quality);

    if (optimizedBlob.size <= MAX_REQUEST_SAFE_BYTES) {
      return {
        blob: optimizedBlob,
        name: changeFileExtension(file.name, "jpg"),
        type: "image/jpeg",
        size: optimizedBlob.size,
        wasOptimized: true,
      };
    }
  }

  throw new Error("This image is too large to submit reliably. Please upload a smaller image or PDF.");
};

export const encodeBlobToBase64 = async (blob: Blob): Promise<string> => {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};