import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
}

export default function UploadZone({ onFileSelect, selectedFile }: UploadZoneProps) {
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      onFileSelect(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp']
    },
    maxSize: 10485760, // 10MB
    multiple: false
  });

  return (
    <div className="w-full">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-dark-card'
          }
        `}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="预览"
              className="max-h-64 mx-auto rounded-lg"
            />
            <p className="text-sm text-gray-400">
              点击或拖拽图片以重新上传
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">📊</div>
            <div>
              <p className="text-lg mb-2">
                {isDragActive ? '释放以上传图片' : '拖拽图片到这里，或点击选择'}
              </p>
              <p className="text-sm text-gray-500">
                支持 JPG, PNG, WEBP 格式，最大 10MB
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <div className="mt-3 text-sm text-gray-400">
          已选择: {selectedFile.name}
        </div>
      )}
    </div>
  );
}
