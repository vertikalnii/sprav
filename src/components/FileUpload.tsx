import React, { useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept: string;
  multiple?: boolean;
  label: string;
  description: string;
  icon: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, accept, multiple = false, label, description, icon }) => {
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFileSelect(files);
    }
  }, [onFileSelect]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      onFileSelect(files);
    }
  }, [onFileSelect]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer group"
    >
      <label className="cursor-pointer block">
        <input
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl group-hover:scale-110 transition-transform">
            {icon}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-700">{label}</p>
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          </div>
          <div className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            Выбрать файл{multiple ? 'ы' : ''}
          </div>
        </div>
      </label>
    </div>
  );
};

export default FileUpload;
