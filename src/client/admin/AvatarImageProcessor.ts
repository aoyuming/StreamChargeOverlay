const DEFAULT_MAX_AVATAR_SIZE = 200;
const WEBP_QUALITY = 0.84;

export type AvatarSize = {
  width: number;
  height: number;
};

export const fitWithinMaxSize = (
  width: number,
  height: number,
  maxSize = DEFAULT_MAX_AVATAR_SIZE
): AvatarSize => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxSize, height: maxSize };
  }

  const scale = Math.min(1, maxSize / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
};

export const compressAvatarFile = async (file: Blob): Promise<string> => {
  const image = await loadImage(file);
  const size = fitWithinMaxSize(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器不支持头像压缩");
  }

  context.drawImage(image, 0, 0, size.width, size.height);
  const webp = await canvasToBlob(canvas, "image/webp", WEBP_QUALITY);
  const output = webp ?? (await canvasToBlob(canvas, "image/png"));
  if (!output) {
    throw new Error("头像压缩失败");
  }

  return blobToDataUrl(output);
};

export const readAvatarFromClipboard = async (): Promise<string> => {
  if (!navigator.clipboard?.read) {
    throw new Error("当前浏览器不支持直接读取剪贴板图片，请复制图片后按 Ctrl+V");
  }

  const items = await navigator.clipboard.read();
  for (const item of items) {
    const imageType = item.types.find((type) => type.startsWith("image/"));
    if (!imageType) {
      continue;
    }

    return compressAvatarFile(await item.getType(imageType));
  }

  throw new Error("剪贴板里没有图片，请先复制一张头像");
};

const loadImage = async (file: Blob): Promise<HTMLImageElement> => {
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("头像图片读取失败"));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const canvasToBlob = async (
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/png",
  quality?: number
): Promise<Blob | null> => {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, quality));
};

const blobToDataUrl = async (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("头像编码失败"));
    reader.readAsDataURL(blob);
  });
};
