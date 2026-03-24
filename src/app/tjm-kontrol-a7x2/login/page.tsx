"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Shield, Lock, Mail, RefreshCw } from "lucide-react";

const ADMIN_EMAIL = "tjmproje@gmail.com";
type Step = "email" | "otp";

export default function AdminLoginPage() {
    const [step, setStep] = useState<Step>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");

    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const router = useRouter();

    const startCountdown = (seconds: number) => {
        setCountdown(seconds);
        const interval = setInterval(() => {
            setCountdown((c) => {
                if (c <= 1) { clearInterval(interval); return 0; }
                return c - 1;
            });
        }, 1000);
    };

    const formatCountdown = (s: number) =>
        `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setError("");

        if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
            setError("Giriş izni sadece yetkili hesaba verilmiştir.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/admin-auth/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Kod gönderilemedi.");
            }

            setStep("otp");
            startCountdown(600); // 10 minutes
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const res = await fetch("/api/admin-auth/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Doğrulama başarısız.");
            }

            // Gelen Custom Token ile Firebase'e giriş yap
            await signInWithCustomToken(auth, data.token);
            router.push("/tjm-kontrol-a7x2");

        } catch (err: any) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Arka plan efekti */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="w-full max-w-sm relative z-10">
                {/* Logo & Başlık */}
                <div className="flex flex-col items-center mb-10">
                    <div className="w-16 h-16 bg-red-950/40 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.15)] mb-5">
                        <Shield size={28} className="text-red-400" />
                    </div>
                    <h1 className="text-2xl font-black tracking-tight text-white">Yönetici Girişi</h1>
                </div>

                {/* Form Alanı */}
                <div className="bg-[#111113] border border-white/5 rounded-3xl p-8 shadow-2xl">

                    {/* ADIM 1: E-POSTA */}
                    {step === "email" && (
                        <form onSubmit={handleSendOtp} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Yetkili E-Posta</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="ornek@tjmcnc.com"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-3.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-red-600/40 transition-all placeholder:text-gray-700"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-bold flex items-center gap-2">
                                    <Lock size={12} /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email.trim()}
                                className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-sm tracking-wide flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : "Doğrulama Kodu Gönder"}
                            </button>
                        </form>
                    )}

                    {/* ADIM 2: OTP */}
                    {step === "otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5 text-center">
                            <div className="bg-red-900/10 inline-flex p-3 rounded-full mb-2 border border-red-500/20">
                                <Mail size={20} className="text-red-400" />
                            </div>
                            <p className="text-sm text-gray-400">
                                <span className="text-white font-bold">{email}</span> adresine gönderilen 6 haneli kodu girin.
                            </p>

                            <div className="space-y-2 text-left pt-2">
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="000000"
                                    maxLength={6}
                                    inputMode="numeric"
                                    className="w-full bg-white/5 border border-white/5 rounded-2xl px-4 py-4 text-2xl font-black text-center text-white outline-none focus:ring-2 focus:ring-red-600/40 transition-all tracking-[0.5em]"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs font-bold flex items-center justify-center gap-2 text-left">
                                    <Lock size={12} className="shrink-0" /> {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading || otp.length < 6}
                                className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all active:scale-95 text-sm tracking-wide flex items-center justify-center gap-2"
                            >
                                {loading ? <RefreshCw size={16} className="animate-spin" /> : "Giriş Yap"}
                            </button>

                            <div className="pt-2">
                                {countdown > 0 ? (
                                    <p className="text-xs text-gray-500">
                                        Kod <span className="text-white font-bold">{formatCountdown(countdown)}</span> içinde geçersiz olacak.
                                    </p>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleSendOtp()}
                                        disabled={loading}
                                        className="text-xs text-red-400 hover:text-red-300 font-bold underline underline-offset-4"
                                    >
                                        Kodu Tekrar Gönder
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                                className="text-xs text-gray-600 hover:text-gray-400 block w-full pt-4 border-t border-white/5"
                            >
                                ← E-posta adresini değiştir
                            </button>
                        </form>
                    )}
                </div>

                <p className="text-center text-gray-700 text-[11px] mt-6">
                    Turkish Jewellery Machine &bull; Yönetici Portalı
                </p>
            </div>
        </div>
    );
}
