interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = '分析中，请稍候...' }: LoadingSpinnerProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-dark-card rounded-lg p-8 max-w-sm w-full mx-4 border border-dark-border">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium mb-1">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
