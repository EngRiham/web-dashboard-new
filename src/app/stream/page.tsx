"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Camera, RefreshCw, Send } from "lucide-react";

function StreamComponent() {
    const searchParams = useSearchParams();
    const serial = searchParams.get("serial");
    const [streaming, setStreaming] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480 }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                setStreaming(true);
            }
        } catch (err) {
            alert("Kamera başlatılamadı: " + err);
        }
    };

    if (!serial) return <div className="p-20 text-white bg-slate-900 min-h-screen">Hata: Seri numarası eksik.</div>;

    return (
        <div className="min-h-screen bg-slate-950 text-white p-8 flex flex-col items-center justify-center">
            <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-2xl w-full text-center">
                <h1 className="text-2xl font-bold mb-2">Kamera Yayını: {serial}</h1>
                <p className="text-slate-400 mb-8 text-sm">Bu sayfa açık kaldığı sürece kamera görüntüsü buluta aktarılır.</p>

                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-slate-700 mb-8">
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} width="640" height="480" className="hidden" />

                    {!streaming && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                            <Camera size={48} className="text-slate-600 animate-pulse" />
                        </div>
                    )}
                </div>

                <div className="flex gap-4 justify-center">
                    {!streaming ? (
                        <button
                            onClick={startCamera}
                            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all"
                        >
                            <RefreshCw size={20} /> Kamerayı Başlat
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 text-green-400 font-bold bg-green-400/10 px-6 py-3 rounded-xl border border-green-400/20">
                            <Send size={20} className="animate-bounce" /> Yayında
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function StreamPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Yükleniyor...</div>}>
            <StreamComponent />
        </Suspense>
    );
}
