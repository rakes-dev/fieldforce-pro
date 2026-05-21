import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

interface CameraCaptureProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
  facingMode?: 'user' | 'environment';
}

export function CameraCapture({ onCapture, onClose, facingMode = 'environment' }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please check permissions.");
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      onCapture(base64);
      setTimeout(() => {
        setIsCapturing(false);
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-300">
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>
        <div className="flex bg-white/10 backdrop-blur-md rounded-full p-1">
          <div className="px-4 py-1 text-[10px] font-black uppercase tracking-widest text-white/50">
            {facingMode === 'environment' ? 'Rear Cam' : 'Front Cam'}
          </div>
        </div>
        <div className="w-12 h-12 flex items-center justify-center">
           <Zap className="w-5 h-5 text-amber-400 opacity-50" />
        </div>
      </div>

      <div className="relative w-full h-full flex items-center justify-center max-w-2xl mx-auto">
        {error ? (
          <div className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
              <Camera className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-white font-bold">{error}</p>
            <button 
              onClick={startCamera}
              className="px-6 py-2 bg-white text-black rounded-full font-bold text-sm"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className={cn(
                "w-full h-full object-cover md:rounded-3xl transition-opacity duration-500",
                isCapturing ? "opacity-50" : "opacity-100"
              )}
            />
            {/* Capture Flash Overlay */}
            {isCapturing && <div className="absolute inset-0 bg-white animate-flash pointer-events-none" />}
            
            {/* Guide Mask */}
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-full max-w-[80%] aspect-[3/4] border-2 border-white/30 rounded-3xl relative">
                  <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                </div>
            </div>
          </>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-12 pb-16 flex items-center justify-center z-10 bg-gradient-to-t from-black/80 to-transparent">
        <button 
          onClick={takePhoto}
          disabled={!stream || isCapturing}
          className="group relative flex items-center justify-center p-1 rounded-full border-4 border-white/30 hover:border-white transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center transition-transform group-hover:scale-105">
            <Camera className="w-8 h-8 text-black" />
          </div>
          {/* Progress ring or pulse could go here */}
        </button>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
