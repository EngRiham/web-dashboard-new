"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, onValue, remove } from "firebase/database";
import { useRouter } from "next/navigation";
import {
    Shield, LogOut, Trash2, Wifi, WifiOff,
    Clock, Package, Monitor, LayoutDashboard, RefreshCw,
    Users, Plus, X, Check, Phone, Mail, MapPin
} from "lucide-react";

interface MachineData {
    operator?: string;
    uptime?: string;
    parts_count?: number;
    last_sync?: string;
    password?: string;
}

interface MachineRow {
    serial: string;
    data: MachineData;
    isOnline: boolean;
}

interface UserRow {
    uid: string;
    email: string;
    createdAt: string;
    machineCount: number;
    machineSerials: string[];
}

export default function AdminPage() {
    const [machines, setMachines] = useState<MachineRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingSerial, setDeletingSerial] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    // User management
    const [users, setUsers] = useState<UserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [addingToUid, setAddingToUid] = useState<string | null>(null); // Which user's form is open
    const [addSerial, setAddSerial] = useState("");
    const [addPass, setAddPass] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [addError, setAddError] = useState("");
    const [addSuccess, setAddSuccess] = useState("");

    const router = useRouter();

    const ADMIN_EMAIL = "tjmproje@gmail.com";

    useEffect(() => {
        return onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push("/tjm-kontrol-a7x2/login");
            } else if (user.email?.toLowerCase() !== ADMIN_EMAIL) {
                // Admin yetkisi yok — çıkış yap ve login'e yönlendir
                signOut(auth).then(() => router.push("/tjm-kontrol-a7x2/login"));
            } else {
                // Admin girişi başarılı -> Kullanıcıları yükle
                loadUsers();
            }
        });
    }, []);

    // Real-time machine feed
    useEffect(() => {
        const machinesRef = ref(db, "machines");
        return onValue(machinesRef, (snapshot) => {
            const val = snapshot.val();
            if (!val) { setMachines([]); setLoading(false); return; }

            const rows: MachineRow[] = Object.entries(val)
                .filter(([key]) => key !== "camera_frame")
                .map(([serial, data]: [string, any]) => {
                    const lastSync = data?.last_sync ? new Date(data.last_sync).getTime() : 0;
                    const isOnline = Date.now() - lastSync < 30000;
                    return { serial, data: data as MachineData, isOnline };
                });

            setMachines(rows);
            setLoading(false);
        });
    }, []);

    // Load user list
    const loadUsers = async () => {
        setUsersLoading(true);
        try {
            const user = auth.currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            const res = await fetch("/api/list-users", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok) setUsers(data.users ?? []);
        } catch (e) {
            console.error("Kullanıcılar yüklenemedi", e);
        } finally {
            setUsersLoading(false);
        }
    };

    // İlk yüklemede manuel çağırmaya gerek yok, onAuthStateChanged tetikleyecek
    // useEffect(() => { loadUsers(); }, []);

    const handleDelete = async (serial: string) => {
        setDeletingSerial(serial);
        try {
            await remove(ref(db, `machines/${serial}`));
            setConfirmDelete(null);
        } catch (e) {
            alert("Silme işlemi başarısız!");
        } finally {
            setDeletingSerial(null);
        }
    };

    const removeUserMachine = async (uid: string, serial: string) => {
        if (!confirm(`"${serial}" makinesini bu kullanıcıdan kaldırmak istediğinize emin misiniz?`)) return;
        try {
            await remove(ref(db, `users/${uid}/machines/${serial}`));
            loadUsers();
        } catch (e) {
            alert("Makine kaldırılamadı!");
        }
    };

    const openAddForm = (uid: string) => {
        setAddingToUid(uid);
        setAddSerial("");
        setAddPass("");
        setAddError("");
        setAddSuccess("");
    };

    const handleAddMachine = async (e: React.FormEvent, uid: string) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError("");
        setAddSuccess("");
        try {
            const user = auth.currentUser;
            if (!user) throw new Error("Oturum bulunamadı.");

            const token = await user.getIdToken();
            const res = await fetch("/api/add-machine-to-user", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ uid, serial: addSerial.trim(), password: addPass }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAddError(data.error ?? "Hata oluştu.");
            } else {
                setAddSuccess("Makine başarıyla eklendi!");
                setAddSerial("");
                setAddPass("");
                loadUsers(); // Refresh user list
                setTimeout(() => {
                    setAddingToUid(null);
                    setAddSuccess("");
                }, 1500);
            }
        } catch (err: any) {
            setAddError(err.message);
        } finally {
            setAddLoading(false);
        }
    };

    const onlineCount = machines.filter((m) => m.isOnline).length;
    const offlineCount = machines.length - onlineCount;

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white font-sans p-8 flex flex-col">
            <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-red-600/20 flex items-center justify-center border border-red-600/30">
                            <Shield size={22} className="text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight">Admin Paneli</h1>
                            <p className="text-gray-500 text-sm">Makine yönetimi &amp; izleme</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-all"
                        >
                            <LayoutDashboard size={16} /> Dashboard
                        </button>
                        <button
                            onClick={() => signOut(auth).then(() => router.push("/tjm-kontrol-a7x2/login"))}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-xl text-sm font-medium text-red-400 transition-all"
                        >
                            <LogOut size={16} /> Çıkış
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-[#141417] border border-white/5 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <Monitor size={18} className="text-gray-400" />
                            <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Toplam</span>
                        </div>
                        <p className="text-4xl font-black">{machines.length}</p>
                        <p className="text-gray-500 text-sm mt-1">kayıtlı makine</p>
                    </div>
                    <div className="bg-[#141417] border border-green-500/20 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <Wifi size={18} className="text-green-400" />
                            <span className="text-xs uppercase tracking-widest text-green-500/70 font-bold">Çevrimiçi</span>
                        </div>
                        <p className="text-4xl font-black text-green-400">{onlineCount}</p>
                        <p className="text-green-500/50 text-sm mt-1">aktif bağlantı</p>
                    </div>
                    <div className="bg-[#141417] border border-red-500/20 rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <WifiOff size={18} className="text-red-400" />
                            <span className="text-xs uppercase tracking-widest text-red-500/70 font-bold">Çevrimdışı</span>
                        </div>
                        <p className="text-4xl font-black text-red-400">{offlineCount}</p>
                        <p className="text-red-500/50 text-sm mt-1">bağlantı yok</p>
                    </div>
                </div>

                {/* Machine Table */}
                <div className="bg-[#141417] border border-white/5 rounded-2xl overflow-hidden mb-8">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <h2 className="font-bold text-sm uppercase tracking-widest text-gray-400">Makine Listesi</h2>
                        <RefreshCw size={14} className="text-gray-600" />
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-gray-600">Yükleniyor...</div>
                    ) : machines.length === 0 ? (
                        <div className="p-12 text-center text-gray-600">Henüz kayıtlı makine yok.</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-widest text-gray-600 border-b border-white/5">
                                    <th className="text-left px-6 py-3">Durum</th>
                                    <th className="text-left px-6 py-3">Seri No</th>
                                    <th className="text-left px-6 py-3">Operatör</th>
                                    <th className="text-left px-6 py-3">Çalışma Süresi</th>
                                    <th className="text-left px-6 py-3">Parça</th>
                                    <th className="text-left px-6 py-3">Son Bağlantı</th>
                                    <th className="text-right px-6 py-3">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {machines.map((m, i) => (
                                    <tr
                                        key={m.serial}
                                        className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                                    >
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${m.isOnline
                                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                                : "bg-red-500/10 text-red-400 border border-red-500/20"
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${m.isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                                                {m.isOnline ? "Çevrimiçi" : "Çevrimdışı"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <code className="text-sm font-bold text-white/90 bg-white/5 px-2 py-0.5 rounded-lg">{m.serial}</code>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                                {m.data.operator || <span className="text-gray-600">—</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm text-gray-300">
                                                <Clock size={13} className="text-gray-600" />
                                                {m.data.uptime || "—"}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-white">
                                                <Package size={13} className="text-gray-600" />
                                                {m.data.parts_count ?? 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">{m.data.last_sync || "—"}</td>
                                        <td className="px-6 py-4 text-right">
                                            {confirmDelete === m.serial ? (
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs text-red-400">Emin misin?</span>
                                                    <button
                                                        onClick={() => handleDelete(m.serial)}
                                                        disabled={deletingSerial === m.serial}
                                                        className="px-3 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-lg font-bold transition-all disabled:opacity-50"
                                                    >
                                                        {deletingSerial === m.serial ? "..." : "Evet, Sil"}
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDelete(null)}
                                                        className="px-3 py-1 text-xs bg-white/10 hover:bg-white/20 rounded-lg font-bold transition-all"
                                                    >
                                                        İptal
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmDelete(m.serial)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 hover:border-red-600/40 text-red-400 rounded-xl font-bold transition-all ml-auto"
                                                >
                                                    <Trash2 size={13} /> Sil
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Kayıtlı Hesaplar ── */}
                <div className="bg-[#141417] border border-white/5 rounded-2xl overflow-hidden mb-8">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Users size={14} className="text-gray-400" />
                            <h2 className="font-bold text-sm uppercase tracking-widest text-gray-400">Kayıtlı Hesaplar</h2>
                        </div>
                        <button
                            onClick={loadUsers}
                            className="text-gray-600 hover:text-gray-400 transition-colors"
                            title="Yenile"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>

                    {usersLoading ? (
                        <div className="p-12 text-center text-gray-600">Yükleniyor...</div>
                    ) : users.length === 0 ? (
                        <div className="p-12 text-center text-gray-600">Henüz kayıtlı hesap yok.</div>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="text-[11px] uppercase tracking-widest text-gray-600 border-b border-white/5">
                                    <th className="text-left px-6 py-3">E-Posta</th>
                                    <th className="text-left px-6 py-3">Kayıt Tarihi</th>
                                    <th className="text-left px-6 py-3">Makineler</th>
                                    <th className="text-right px-6 py-3">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <>
                                        <tr
                                            key={u.uid}
                                            className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                                        >
                                            <td className="px-6 py-4 text-sm font-medium text-white/80">{u.email}</td>
                                            <td className="px-6 py-4 text-xs text-gray-500">
                                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString("tr-TR") : "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {u.machineSerials.length === 0 ? (
                                                        <span className="text-gray-600 text-xs">Makine yok</span>
                                                    ) : (
                                                        u.machineSerials.map((s) => (
                                                            <span key={s} className="inline-flex items-center gap-1 text-[11px] font-bold bg-white/5 border border-white/5 pl-2 pr-1 py-0.5 rounded-lg text-white/70">
                                                                <code>{s}</code>
                                                                <button
                                                                    onClick={() => removeUserMachine(u.uid, s)}
                                                                    className="ml-0.5 text-gray-600 hover:text-red-400 transition-colors rounded p-0.5 hover:bg-red-500/10"
                                                                    title={`${s} sil`}
                                                                >
                                                                    <X size={10} />
                                                                </button>
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {addingToUid === u.uid ? (
                                                    <button
                                                        onClick={() => setAddingToUid(null)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 border border-white/10 text-gray-400 rounded-xl font-bold transition-all ml-auto"
                                                    >
                                                        <X size={13} /> İptal
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => openAddForm(u.uid)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600/10 hover:bg-blue-600/20 border border-blue-600/20 hover:border-blue-600/40 text-blue-400 rounded-xl font-bold transition-all ml-auto"
                                                    >
                                                        <Plus size={13} /> Makine Ekle
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Inline Add Machine Form */}
                                        {addingToUid === u.uid && (
                                            <tr key={`${u.uid}-form`} className="bg-blue-950/10 border-b border-white/5">
                                                <td colSpan={4} className="px-6 py-4">
                                                    <form onSubmit={(e) => handleAddMachine(e, u.uid)} className="flex items-end gap-3 flex-wrap">
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Seri Numarası</label>
                                                            <input
                                                                value={addSerial}
                                                                onChange={(e) => setAddSerial(e.target.value)}
                                                                placeholder="CNC-789-ALPHA"
                                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/40 w-52"
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Makine Şifresi</label>
                                                            <input
                                                                type="password"
                                                                value={addPass}
                                                                onChange={(e) => setAddPass(e.target.value)}
                                                                placeholder="••••••••"
                                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/40 w-44"
                                                                required
                                                            />
                                                        </div>
                                                        <button
                                                            type="submit"
                                                            disabled={addLoading}
                                                            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition-all disabled:opacity-50 active:scale-95"
                                                        >
                                                            {addLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                                                            {addLoading ? "Ekleniyor..." : "Ekle"}
                                                        </button>
                                                        {addError && <p className="text-red-400 text-xs font-medium">{addError}</p>}
                                                        {addSuccess && <p className="text-green-400 text-xs font-bold">✓ {addSuccess}</p>}
                                                    </form>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <footer className="mt-auto pt-10 border-t border-white/5">
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
                            <a href="https://wa.me/905519492104" target="_blank" rel="noopener noreferrer"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-green-500/20 border border-white/5 hover:border-green-500/30 transition-all"
                                title="WhatsApp">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-green-500">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                                    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.855L.057 23.926a.5.5 0 00.613.613l6.071-1.471A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.726 9.726 0 01-4.926-1.337l-.353-.21-3.664.888.905-3.585-.231-.37A9.714 9.714 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z" />
                                </svg>
                            </a>
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
            </div>
        </div>
    );
}
