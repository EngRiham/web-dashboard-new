"use client";

import { useState, useMemo } from "react";
import { auth } from "@/lib/firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { Check, X, Shield, Mail, RefreshCw } from "lucide-react";

// Şifre kuralları
const PASSWORD_RULES = [
    { id: "length", label: "En az 8 karakter", test: (p: string) => p.length >= 8 },
    { id: "uppercase", label: "En az 1 büyük harf", test: (p: string) => /[A-Z]/.test(p) },
    { id: "lowercase", label: "En az 1 küçük harf", test: (p: string) => /[a-z]/.test(p) },
    { id: "number", label: "En az 1 rakam", test: (p: string) => /[0-9]/.test(p) },
    { id: "symbol", label: "En az 1 sembol (!@#$%)", test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

type Step = "credentials" | "otp";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState("");
    const [showRules, setShowRules] = useState(false);

    // 2FA state
    const [step, setStep] = useState<Step>("credentials");
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState("");
    const [uid, setUid] = useState("");
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    const router = useRouter();

    // Şifre kural kontrolü
    const ruleResults = useMemo(
        () => PASSWORD_RULES.map((r) => ({ ...r, passed: r.test(password) })),
        [password]
    );
    const allRulesPassed = ruleResults.every((r) => r.passed);
    const strengthScore = ruleResults.filter((r) => r.passed).length;
    const strengthColors = ["bg-red-600", "bg-orange-500", "bg-yellow-500", "bg-lime-500", "bg-green-500"];
    const strengthLabels = ["Çok Zayıf", "Zayıf", "Orta", "İyi", "Güçlü"];

    // ADIM 1: E-posta/şifre girişi ve OTP gönderimi
    const handleCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!isLogin && !allRulesPassed) {
            setError("Lütfen tüm şifre kurallarını karşılayan bir şifre belirleyin.");
            setShowRules(true);
            return;
        }

        setSending(true);
        try {
            let userCredential;
            if (isLogin) {
                userCredential = await signInWithEmailAndPassword(auth, email, password);
            } else {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            }

            const userUid = userCredential.user.uid;
            setUid(userUid);

            // OTP gönder
            const res = await fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: userUid, email }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "OTP gönderilemedi.");
            }

            // OTP ekranına geç, geri sayım başlat
            setStep("otp");
            startCountdown(300); // 5 dakika

        } catch (err: any) {
            const msg = err.code;
            if (msg === "auth/email-already-in-use") setError("Bu e-posta zaten kayıtlı.");
            else if (msg === "auth/invalid-credential") setError("E-posta veya şifre hatalı.");
            else if (msg === "auth/user-not-found") setError("Kullanıcı bulunamadı.");
            else if (msg === "auth/wrong-password") setError("Şifre hatalı.");
            else if (msg === "auth/weak-password") setError("Şifre çok zayıf.");
            else setError(err.message);
        } finally {
            setSending(false);
        }
    };

    // ADIM 2: OTP doğrulama
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError("");
        setVerifying(true);

        try {
            const res = await fetch("/api/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid, code: otp }),
            });

            const data = await res.json();
            if (!res.ok) {
                setOtpError(data.error || "Doğrulama başarısız.");
                return;
            }

            router.push("/dashboard");
        } catch {
            setOtpError("Bir hata oluştu. Lütfen tekrar deneyin.");
        } finally {
            setVerifying(false);
        }
    };

    // Geri sayım sayacı
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

    // Yeniden OTP gönder
    const resendOtp = async () => {
        setSending(true);
        setOtpError("");
        try {
            await fetch("/api/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid, email }),
            });
            startCountdown(300);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#0a0a0b] text-white font-[family-name:var(--font-geist-sans)] relative overflow-hidden">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="flex-grow flex items-center justify-center w-full z-10 px-6 py-12">
                <div className="w-full max-w-md">
                    <div className="bg-[#141417] border border-white/5 p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-xl">

                        {/* Logo */}
                        <div className="flex flex-col items-center mb-8">
                            <div className="w-20 h-20 mb-5 relative group">
                                <div className="absolute inset-0 bg-red-600/20 blur-2xl group-hover:bg-red-600/30 transition-all duration-500 rounded-full" />
                                <img src="/logo.png" alt="Logo"
                                    className="w-full h-full object-contain relative transition-transform duration-500 group-hover:scale-110"
                                    onError={(e: any) => e.target.style.display = "none"} />
                            </div>
                            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent text-center">
                                Turkish Jewellery Machine
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Endüstriyel Cihaz Takip Sistemi</p>
                        </div>

                        {/* ── ADIM 1: Giriş Bilgileri ── */}
                        {step === "credentials" && (
                            <form onSubmit={handleCredentials} className="space-y-5">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">E-posta</label>
                                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-[#1c1c21] border border-white/5 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all text-sm"
                                        placeholder="ornek@sirket.com" required />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Şifre</label>
                                    <input type="password" value={password}
                                        onChange={(e) => { setPassword(e.target.value); if (!isLogin) setShowRules(true); }}
                                        className="w-full bg-[#1c1c21] border border-white/5 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all text-sm"
                                        placeholder="••••••••" required />
                                </div>

                                {/* Şifre gücü — sadece kayıt modunda */}
                                {!isLogin && showRules && (
                                    <div className="bg-[#1c1c21] border border-white/5 rounded-2xl p-4 space-y-3">
                                        <div>
                                            <div className="flex justify-between mb-1.5">
                                                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Şifre Gücü</span>
                                                {password.length > 0 && (
                                                    <span className={`text-[11px] font-bold ${strengthScore >= 4 ? "text-green-400" : strengthScore >= 3 ? "text-yellow-400" : "text-red-400"}`}>
                                                        {strengthLabels[strengthScore - 1] ?? "Çok Zayıf"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strengthScore ? strengthColors[strengthScore - 1] : "bg-white/10"}`} />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            {ruleResults.map((rule) => (
                                                <div key={rule.id} className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${rule.passed ? "bg-green-500/20 text-green-400" : "bg-white/5 text-gray-600"}`}>
                                                        {rule.passed ? <Check size={10} strokeWidth={3} /> : <X size={10} strokeWidth={3} />}
                                                    </div>
                                                    <span className={`text-[12px] ${rule.passed ? "text-green-400" : "text-gray-500"}`}>{rule.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] p-3 rounded-xl text-center whitespace-pre-wrap">{error}</div>
                                )}

                                <button type="submit" disabled={sending || (!isLogin && showRules && !allRulesPassed)}
                                    className="w-full py-4 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all shadow-xl shadow-red-900/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {sending ? <><RefreshCw size={16} className="animate-spin" /> Kod Gönderiliyor...</> : isLogin ? "Giriş Yap" : "Hesap Oluştur"}
                                </button>
                            </form>
                        )}

                        {/* ── ADIM 2: OTP Doğrulama ── */}
                        {step === "otp" && (
                            <form onSubmit={handleVerifyOtp} className="space-y-5">
                                <div className="text-center">
                                    <div className="w-14 h-14 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <Shield size={24} className="text-red-400" />
                                    </div>
                                    <h2 className="text-lg font-bold mb-1">İki Adımlı Doğrulama</h2>
                                    <p className="text-gray-500 text-sm flex items-center justify-center gap-1.5">
                                        <Mail size={13} /> <span className="text-white/70">{email}</span> adresine kod gönderildi
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 ml-1">6 Haneli Kod</label>
                                    <input
                                        type="text"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                        className="w-full bg-[#1c1c21] border border-white/5 p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-600/50 transition-all text-2xl font-black text-center tracking-[0.5em]"
                                        placeholder="000000"
                                        maxLength={6}
                                        inputMode="numeric"
                                        required
                                    />
                                </div>

                                {otpError && (
                                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] p-3 rounded-xl text-center">{otpError}</div>
                                )}

                                <button type="submit" disabled={verifying || otp.length < 6}
                                    className="w-full py-4 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all shadow-xl shadow-red-900/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                                    {verifying ? <><RefreshCw size={16} className="animate-spin" /> Doğrulanıyor...</> : "Doğrula ve Giriş Yap"}
                                </button>

                                {/* Geri sayım ve yeniden gönder */}
                                <div className="text-center">
                                    {countdown > 0 ? (
                                        <p className="text-gray-500 text-[13px]">
                                            Kod <span className="text-white font-bold">{formatCountdown(countdown)}</span> içinde geçerliliğini yitirecek
                                        </p>
                                    ) : (
                                        <button type="button" onClick={resendOtp} disabled={sending}
                                            className="text-red-400 hover:text-red-300 text-[13px] font-bold transition-colors flex items-center gap-1 mx-auto">
                                            <RefreshCw size={13} /> Kodu Yeniden Gönder
                                        </button>
                                    )}
                                </div>

                                <button type="button" onClick={() => { setStep("credentials"); setOtp(""); setOtpError(""); }}
                                    className="w-full text-gray-500 hover:text-white text-[13px] transition-colors">
                                    ← Geri dön
                                </button>
                            </form>
                        )}

                        {/* Mode geçişi — sadece giriş bilgileri adımında */}
                        {step === "credentials" && (
                            <div className="mt-8 pt-8 border-t border-white/5 text-center">
                                <button onClick={() => { setIsLogin(!isLogin); setError(""); setShowRules(false); setPassword(""); }}
                                    className="text-[13px] text-gray-500 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 w-full">
                                    {isLogin ? (
                                        <><span>Hesabınız yok mu?</span> <span className="text-red-500 font-bold underline underline-offset-4">Kayıt olun</span></>
                                    ) : (
                                        <><span>Zaten hesabınız var mı?</span> <span className="text-red-500 font-bold underline underline-offset-4">Giriş yapın</span></>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
