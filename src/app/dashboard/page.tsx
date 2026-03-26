"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, update, get } from "firebase/database";
import { useRouter } from "next/navigation";
import MachineCard from "@/components/MachineCard";
import { LogOut, LayoutDashboard, User as UserIcon, Shield, Phone, Mail, MapPin } from "lucide-react";

export default function DashboardPage() {
    const [user, setUser] = useState<any>(null);
    const [machines, setMachines] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                try {
                    // User'a bağlı makineleri getir
                    const userRef = ref(db, `users/${user.uid}/machines`);
                    const snapshot = await get(userRef);
                    if (snapshot.exists()) {
                        setMachines(Object.keys(snapshot.val()));
                    }
                } catch (err) {
                    console.error("Database error:", err);
                } finally {
                    setLoading(false);
                }
            } else {
                router.push("/login");
            }
        });
    }, [router]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    if (loading) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Yükleniyor...</div>;

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white font-[family-name:var(--font-geist-sans)] flex flex-col md:flex-row">
            {/* Sidebar / Header */}
            <aside className="w-full md:w-72 bg-[#111113] border-b md:border-b-0 md:border-r border-white/5 flex flex-col p-6 z-20 pb-14">
                <div className="flex items-center justify-between md:flex-col md:items-start gap-3 mb-4 md:mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-red-950/30 rounded-2xl flex items-center justify-center border border-red-500/20 shadow-[0_0_20px_rgba(220,38,38,0.1)]">
                            <img src="/logo.png" alt="Logo" className="w-12 h-12 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                        </div>
                        <div>
                            <span className="font-extrabold text-lg tracking-tight block leading-tight">TJM</span>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Cnc Monitor</span>
                        </div>
                    </div>

                    <button onClick={handleLogout} className="md:hidden p-2 text-gray-400 hover:text-white transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1.5 hidden md:block">
                    <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-600/10 text-red-500 rounded-2xl font-bold text-sm tracking-wide">
                        <LayoutDashboard size={18} /> Dashboard
                    </button>

                    <div className="px-4 py-8">
                        <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em] mb-4">Hesap</p>
                        <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5 mb-3">
                            <div className="w-10 h-10 bg-red-950/50 rounded-full flex items-center justify-center text-red-500 border border-red-500/20">
                                <UserIcon size={20} />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[13px] font-bold truncate">{user?.email?.split('@')[0]}</p>
                                <p className="text-[10px] text-gray-500 font-medium">Yönetici</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all font-bold text-sm"
                        >
                            <LogOut size={16} /> Oturumu Kapat
                        </button>
                    </div>
                </nav>


            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-12 overflow-y-auto relative flex flex-col">
                <div className="absolute top-0 right-0 w-[30%] h-[30%] bg-red-900/5 blur-[120px] rounded-full -z-10"></div>

                <header className="flex justify-center items-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-mono font-black tracking-[0.3em] uppercase text-center text-gray-500/80">
                        Cihaz Merkezi
                    </h2>
                </header>

                <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-12 content-start">
                    {machines.map((serial) => (
                        <MachineCard key={serial} serial={serial} />
                    ))}
                    {machines.length === 0 && (
                        <div className="col-span-full py-20 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-500">
                            <p className="text-lg">Henüz bir makine bağlı değil.</p>
                            <p className="text-sm mt-2 text-slate-600">Makine eklemek için admin panelini kullanın.</p>
                        </div>
                    )}
                </div>

                {/* Footer — sayfanın en altında, içerikle birlikte */}
                <footer className="mt-auto pt-16 border-t border-white/5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-4">
                        {/* Marka */}
                        <div>
                            <p className="text-[11px] font-black tracking-[0.2em] text-gray-500 uppercase mb-1">Turkish Jewellery Machine</p>
                            <p className="text-[10px] text-gray-700 tracking-widest uppercase">&copy; 2026 Tüm Hakları Saklıdır</p>
                        </div>

                        {/* İletişim */}
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            <a href="tel:+905519492104" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                                <Phone size={11} /><span>Ofis: +90 551 949 21 04</span>
                            </a>
                            <a href="tel:+905011606605" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                                <Phone size={11} /><span>Servis: +90 501 160 66 05</span>
                            </a>
                            <a href="mailto:info@tjmcnc.com" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                                <Mail size={11} /><span>info@tjmcnc.com</span>
                            </a>
                            <span className="flex items-center gap-1.5 text-[11px] text-gray-600">
                                <MapPin size={11} /><span>Bayrampaşa / İstanbul</span>
                            </span>
                        </div>

                        {/* Sosyal */}
                        <div className="flex items-center gap-3">
                            {/* WhatsApp */}
                            <a href="https://wa.me/905519492104" target="_blank" rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-green-500/20 border border-white/5 hover:border-green-500/30 transition-all"
                                title="WhatsApp">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-green-500">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.926a.5.5 0 00.613.613l6.071-1.471A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.726 9.726 0 01-4.926-1.337l-.353-.21-3.664.888.905-3.585-.231-.37A9.714 9.714 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
                                </svg>
                            </a>
                            {/* Instagram */}
                            <a href="https://www.instagram.com/tjm_mucahit_denizli?igsh=MXMxajVvM3ZiejR5eg%3D%3D" target="_blank" rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-pink-500/20 border border-white/5 hover:border-pink-500/30 transition-all"
                                title="Instagram">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-pink-400">
                                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                                    <circle cx="12" cy="12" r="4" />
                                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
