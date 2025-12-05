const DEFAULT_MAX_DIMENSION = 640;
const DEFAULT_QUALITY = 0.7;

interface CompressOptions {
  maxDimension?: number;
  quality?: number;
}

export function generateCompressedBase64(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = DEFAULT_MAX_DIMENSION, quality = DEFAULT_QUALITY } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = () => {
        let { width, height } = img;

        if (width > height) {
          if (width > maxDimension) {
            height = (height * maxDimension) / width;
            width = maxDimension;
          }
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width));
        canvas.height = Math.max(1, Math.round(height));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        try {
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = reader.result as string;
    };

    reader.onerror = () => reject(new Error('图片读取失败'));

    reader.readAsDataURL(file);
  });
}
