"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, push, set, serverTimestamp, update, get, remove } from "firebase/database";
import { Camera, Clock, Activity, Maximize2, X, ArrowUpRight, MessageSquare, Send, User, Monitor, ImageIcon, Maximize, Minimize } from "lucide-react";

interface MachineProps {
    serial: string;
}

interface MachineData {
    operator: string;
    uptime: string;
    parts_count: number;
    last_sync: string;
    camera_frame?: string;
    desktop_frame?: string;
    extra_value?: number;
    data_1?: string;
    data_2?: string;
    data_3?: string;
    data_4?: string;
}

interface ChatMessage {
    id: string;
    sender: 'admin' | 'operator';
    text: string;
    timestamp: number;
    image?: string;
}

export default function MachineCard({ serial }: MachineProps) {
    const [data, setData] = useState<MachineData | null>(null);
    const [isOnline, setIsOnline] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isRemoteViewing, setIsRemoteViewing] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [mountTime] = useState(Date.now());

    // "Son İyi Kare" belleği
    const lastGoodFrame = useRef<string | null>(null);
    const [displayFrame, setDisplayFrame] = useState<string | null>(null);

    // Chat State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [chatLoading, setChatLoading] = useState(false);
    const [isChatExpanded, setIsChatExpanded] = useState(false); // Yeni state
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
    const lastSeenMsgId = useRef<string | null>(null);

    // Veri Takibi (Firebase)
    useEffect(() => {
        if (!serial) return;

        const machineRef = ref(db, `machines/${serial}`);
        const unsubscribe = onValue(machineRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                setData(val);

                // Online Durumu (Son 30 sn)
                if (val.last_sync) {
                    const lastSyncTS = new Date(val.last_sync.replace(' ', 'T')).getTime();
                    const nowTS = Date.now();
                    setIsOnline(nowTS - lastSyncTS < 30000);

                    // SIFIRLAMA MANTIĞI: Eğer görüntü mountTime'dan eskiyse gösterme
                    const isFresh = lastSyncTS > mountTime;

                    if (isFresh) {
                        // Kamera Görüntüsü
                        if (val.camera_frame) {
                            const cleaned = val.camera_frame.replace(/[\r\n\s]/g, '');
                            if (cleaned.length > 100) {
                                lastGoodFrame.current = cleaned;
                                setDisplayFrame(cleaned);
                            }
                        }
                    } else {
                        // Eski görüntüleri temizle
                        setDisplayFrame(null);
                        lastGoodFrame.current = null;
                        // data içindeki desktop_frame'i temizlemek için data state'ini de manipüle edebiliriz
                        // ama data Snapshot'tan geldiği için aşağıda UI'da kontrol etmek daha temiz.
                    }
                }
            } else {
                setData(null);
                setIsOnline(false);
            }
        });

        return () => unsubscribe();
    }, [serial]);

    // Mesaj Takibi (Chat)
    useEffect(() => {
        if (!serial) return;

        const chatRef = ref(db, `machines/${serial}/chat/messages`);

        // TEMİZLİK: Dashboard ilk açıldığında geçmişteki "hayalet" mesajları Firebase'den siliyoruz
        get(chatRef).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.keys(data).forEach((msgId) => {
                    const msg = data[msgId];
                    // Eğer mesaj dashboard açılmadan önceyse sil (veya hepsini silip sıfırla)
                    if ((msg.timestamp || 0) < mountTime) {
                        remove(ref(db, `machines/${serial}/chat/messages/${msgId}`));
                    }
                });
            }
        });

        const unsubscribe = onValue(chatRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                const msgList: ChatMessage[] = Object.entries(val).map(([id, m]: [string, any]) => ({
                    id,
                    ...m
                }))
                    .filter(m => (m.timestamp || Date.now()) > mountTime) // Sadece bu oturumu göster
                    .sort((a, b) => (a.timestamp || Date.now()) - (b.timestamp || Date.now()));

                // Bildirim Mantığı: Sadece en son mesaj operatördense ve daha önce görmediysek göster
                if (msgList.length > 0) {
                    const latest = msgList[msgList.length - 1];
                    if (latest.sender === 'operator' && latest.id !== lastSeenMsgId.current) {
                        lastSeenMsgId.current = latest.id;
                        // Sadece ilk yükleme değilse bildirim göster
                        setToast({ message: `Operatörden mesaj: ${latest.text}`, visible: true });
                        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 5000);
                    } else if (latest.sender === 'admin') {
                        // Kendi mesajımızsa id'yi güncelle ki bildirim tetiklemesin
                        lastSeenMsgId.current = latest.id;
                    }
                }

                setMessages(msgList);
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            } else {
                setMessages([]);
            }
        });

        return () => unsubscribe();
    }, [serial]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || chatLoading) return;

        setChatLoading(true);
        try {
            const chatRef = ref(db, `machines/${serial}/chat/messages`);
            const newMsgRef = push(chatRef);
            await set(newMsgRef, {
                sender: 'admin',
                text: newMessage.trim(),
                timestamp: serverTimestamp()
            });
            setNewMessage("");
        } catch (err) {
            console.error("Mesaj gönderilemedi:", err);
        } finally {
            setChatLoading(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !serial) return;

        const reader = new FileReader();
        reader.onload = async (ev) => {
            let base64 = ev.target?.result as string;
            if (base64.includes(',')) base64 = base64.split(',')[1];

            const chatRef = ref(db, `machines/${serial}/chat/messages`);
            await push(chatRef, {
                sender: 'admin',
                text: '[FOTOĞRAF GÖNDERİLDİ]',
                image: base64,
                timestamp: serverTimestamp()
            });
            // İşlem bitince input'u temizle
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsDataURL(file);
    };

    const toggleRemoteView = async (active: boolean) => {
        setIsRemoteViewing(active);
        try {
            const remoteRef = ref(db, `machines/${serial}/remote_control`);
            await update(remoteRef, {
                active_view: active ? 'desktop' : 'camera'
            });
        } catch (err) {
            console.error("Görünüm modu değiştirilemedi:", err);
        }
    };

    const openImageInNewTab = (base64Str: string) => {
        try {
            const byteCharacters = atob(base64Str);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            const blobUrl = URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');
        } catch (e) {
            console.error("Görsel yeni sekmede açılamadı:", e);
        }
    };

    // Klavye Kontrolleri
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsFullscreen(false);
        };
        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    // Yükleniyor Ekranı
    if (!data) {
        return (
            <div className="bg-[#111113] p-8 rounded-[2rem] border border-white/5 animate-pulse h-80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Activity className="text-white/10 animate-spin" size={32} />
                    <p className="text-white/20 text-xs font-black tracking-widest uppercase">{serial} Bekleniyor...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="keep-dark flex flex-col w-full max-w-[420px] mx-auto group relative transition-all duration-500 hover:scale-[1.02] mb-12">
                {/* --- CNC MACHINE TOP (Head) --- */}
                <div className="relative h-20 bg-[#1a1a1e] flex items-center justify-center rounded-t-[2.5rem] border-x border-t border-white/10 overflow-hidden shadow-2xl">
                    <div className="absolute inset-x-4 top-2 bottom-0 bg-[#252529] border-t border-x border-red-500/20 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                        style={{ clipPath: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)' }}>
                        <div className="w-full h-full flex items-center justify-center opacity-90 group-hover:opacity-100 transition-opacity">
                            <img src="/logo.png" alt="TJM" className="h-10 object-contain drop-shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                        </div>
                    </div>
                </div>

                {/* --- CNC MACHINE BODY (Main) --- */}
                <div className="relative bg-red-600 p-1 flex flex-col border-x border-white/10 shadow-2xl">
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/5 pointer-events-none" />

                    {/* Window Area (Camera Feed) */}
                    <div className="relative mx-5 mt-8 mb-4 bg-black rounded-xl border-[6px] border-[#1a1a1e] shadow-[inset_0_10px_20px_rgba(0,0,0,0.9),0_5px_15px_rgba(0,0,0,0.3)] overflow-hidden group/cam">
                        {displayFrame ? (
                            <>
                                <img
                                    src={`data:image/jpeg;base64,${displayFrame}`}
                                    alt="CNC Camera"
                                    className="w-full aspect-video object-cover transition-transform duration-1000 group-hover/cam:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/cam:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-[2px] z-30">
                                    <button
                                        onClick={() => setIsFullscreen(true)}
                                        className="bg-red-600 hover:bg-red-500 text-white p-4 rounded-2xl shadow-2xl transform scale-75 group-hover/cam:scale-100 transition-all duration-500 flex items-center gap-3 font-black uppercase text-[10px] tracking-widest border border-white/20"
                                    >
                                        <Maximize2 size={24} /> TAM EKRAN İZLE
                                    </button>
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
                            </>
                        ) : (
                            <div className="w-full aspect-video bg-black flex items-center justify-center py-10">
                                <Activity className="text-white/20 animate-pulse" size={48} />
                            </div>
                        )}
                    </div>

                    {/* Stats & Controls Area */}
                    <div className="px-7 py-5 flex flex-col gap-6 relative z-10">
                        <div className="flex justify-between items-center gap-4">
                            <div className="bg-black/30 px-5 py-3 rounded-2xl backdrop-blur-md border border-white/10 flex-shrink-0">
                                <h3 className="text-xl font-black text-white tracking-tighter drop-shadow-2xl flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-400 animate-pulse shadow-[0_0_12px_rgba(74,222,128,0.9)]' : 'bg-black border border-white/20'}`}></div>
                                    {serial}
                                </h3>
                                <p className={`text-[9px] font-black uppercase tracking-[0.2em] mt-1 ${isOnline ? 'text-green-300' : 'text-black/50'}`}>
                                    {isOnline ? 'SİSTEM ÇEVRİMİÇİ' : 'BAĞLANTI KESİLDİ'}
                                </p>
                            </div>

                            <div className="flex gap-2 items-center">
                                <button
                                    onClick={() => setShowInfo(!showInfo)}
                                    className={`p-3.5 rounded-2xl border transition-all shadow-2xl relative ${showInfo ? 'bg-white text-red-600 border-white' : 'bg-[#1a1a1e] text-white border-white/10 hover:border-white/30'}`}
                                >
                                    <ArrowUpRight size={20} className={`transition-transform duration-500 ${showInfo ? 'rotate-45' : ''}`} />
                                    {showInfo && (
                                        <div className="absolute bottom-full right-0 mb-6 w-60 bg-[#0a0a0b]/95 backdrop-blur-2xl border border-white/10 p-7 rounded-[2.5rem] shadow-[0_40px_80px_rgba(0,0,0,0.9)] z-50 animate-in zoom-in-90 fade-in duration-300 text-left">
                                            <div className="space-y-6">
                                                <div className="bg-white/5 p-4 rounded-3xl">
                                                    <p className="text-[10px] uppercase font-black tracking-[0.3em] text-gray-500 mb-2 flex items-center gap-2 font-mono"><Clock size={12} /> SON SENKRON</p>
                                                    <p className="text-lg font-mono font-bold text-white tracking-widest uppercase">
                                                        {data.last_sync ? new Date(data.last_sync.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                    </p>
                                                </div>
                                                <div className="bg-red-600/10 p-4 rounded-3xl border border-red-500/20">
                                                    <p className="text-[10px] uppercase font-black tracking-[0.3em] text-red-400 mb-2 flex items-center gap-2 font-mono"><Activity size={12} /> TOPLAM MESAİ</p>
                                                    <p className="text-lg font-mono font-bold text-red-500 tracking-widest uppercase">{data.uptime || '—'}</p>
                                                </div>
                                            </div>
                                            <div className="absolute -bottom-2 right-6 w-5 h-5 bg-[#0a0a0b] border-r border-b border-white/10 rotate-45"></div>
                                        </div>
                                    )}
                                </button>
                                <button
                                    onClick={() => toggleRemoteView(!isRemoteViewing)}
                                    className={`p-3.5 rounded-2xl border transition-all shadow-2xl ${isRemoteViewing ? 'bg-amber-500 text-white border-amber-400' : 'bg-[#1a1a1e] text-white border-white/10 hover:border-white/30'}`}
                                    title="Masaüstü İzleme"
                                >
                                    <Monitor size={20} />
                                </button>
                            </div>
                        </div>

                        {/* RESTORED DATA BOXES */}
                        <div className="grid grid-cols-3 gap-3 pb-4">
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-red-500 transition-colors text-center w-full">UPTIME</p>
                                <p className="text-[13px] font-mono font-black text-red-500 leading-none tracking-tight text-center w-full whitespace-nowrap">{data.uptime || '—'}</p>
                            </div>
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-white transition-colors text-center w-full">UNITS</p>
                                <p className="text-[13px] font-mono font-black text-white leading-none tracking-tight text-center w-full whitespace-nowrap">{data.parts_count ?? 0}</p>
                            </div>
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-emerald-500 transition-colors text-center w-full">DURUM</p>
                                {data.extra_value === 1 ? (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                        <p className="text-[13px] font-black text-emerald-500 leading-none tracking-tight text-center uppercase">ÇALIŞIYOR</p>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                                        <p className="text-[13px] font-black text-red-500 leading-none tracking-tight text-center uppercase">DURDU</p>
                                    </div>
                                )}
                            </div>
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-cyan-500 transition-colors text-center w-full">VERİ 2</p>
                                <p className="text-[13px] font-mono font-black text-cyan-500 leading-none tracking-tight text-center w-full whitespace-nowrap">{data.data_2 || '—'}</p>
                            </div>
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-emerald-500 transition-colors text-center w-full">VERİ 3</p>
                                <p className="text-[13px] font-mono font-black text-emerald-500 leading-none tracking-tight text-center w-full whitespace-nowrap">{data.data_3 || '—'}</p>
                            </div>
                            <div className="bg-[#0a0a0b] p-3 rounded-2xl border-2 border-[#1a1a1e] shadow-[inset_0_4px_10px_rgba(0,0,0,0.5)] group/stat flex flex-col items-center justify-center">
                                <p className="text-[9px] font-black tracking-[0.2em] text-gray-600 uppercase mb-1 group-hover/stat:text-purple-500 transition-colors text-center w-full">VERİ 4</p>
                                <p className="text-[13px] font-mono font-black text-purple-500 leading-none tracking-tight text-center w-full whitespace-nowrap">{data.data_4 || '—'}</p>
                            </div>
                        </div>

                        {/* --- CHAT AREA --- */}
                        {isChatExpanded && (
                            <div className="fixed inset-0 z-[115] bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setIsChatExpanded(false)} />
                        )}
                        <div className={`bg-black/90 rounded-3xl border border-white/10 overflow-hidden flex flex-col group/chat transition-all duration-300 ${isChatExpanded ? 'fixed inset-4 sm:inset-10 z-[120] shadow-[0_0_100px_rgba(220,38,38,0.15)]' : 'h-[280px] mt-2 mb-4'}`}>
                            <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <MessageSquare size={14} className="text-red-500" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">OPERATÖR MESAJLAŞMA</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsChatExpanded(!isChatExpanded)}
                                        className="text-gray-500 hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg border border-white/5 hover:bg-white/10"
                                        title={isChatExpanded ? "Küçült" : "Büyüt"}
                                    >
                                        {isChatExpanded ? <Minimize size={14} /> : <Maximize size={14} />}
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1 h-1 rounded-full bg-red-500 animate-ping"></div>
                                        <span className="text-[8px] font-bold text-red-500/50">CANLI</span>
                                    </div>
                                </div>
                            </div>

                            {/* Messages List */}
                            <div
                                ref={scrollRef}
                                className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
                            >
                                {messages.length === 0 ? (
                                    <div className="h-full flex items-center justify-center opacity-20 flex-col gap-2">
                                        <MessageSquare size={32} />
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Henüz mesaj yok</p>
                                    </div>
                                ) : (
                                    messages.map((m) => (
                                        <div key={m.id} className={`flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                                            <div className={`p-3 rounded-2xl max-w-[85%] ${m.sender === 'admin' ? 'bg-red-600 text-white rounded-tr-none border border-red-500' : 'bg-[#1a1a1e] text-gray-300 rounded-tl-none border border-white/10'}`}>
                                                <p className="text-[13px] leading-relaxed">{m.text}</p>
                                                {m.image && (
                                                    <img
                                                        src={`data:image/jpeg;base64,${m.image}`}
                                                        alt="Chat Attached"
                                                        className={`mt-2 w-full ${isChatExpanded ? 'max-w-[400px]' : 'max-w-[200px]'} rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-white/10 shadow-md`}
                                                        onClick={() => m.image && openImageInNewTab(m.image)}
                                                    />
                                                )}
                                            </div>
                                            <span className="text-[8px] font-bold text-gray-600 mt-1 uppercase tracking-tighter">
                                                {m.sender === 'admin' ? 'SİZ (ADMİN)' : 'OPERATÖR'} • {m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Input Form */}
                            <form onSubmit={handleSendMessage} className="p-3 bg-black/60 border-t border-white/5 flex gap-2">
                                <input
                                    type="file"
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleImageUpload}
                                />
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95 shadow-lg"
                                    title="Fotoğraf Gönder"
                                >
                                    <ImageIcon size={18} />
                                </button>
                                <input
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Mesaj yazın..."
                                    className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white placeholder:text-gray-600 outline-none focus:ring-1 focus:ring-red-500/50 transition-all font-medium"
                                />
                                <button
                                    type="submit"
                                    disabled={!newMessage.trim() || chatLoading}
                                    className="h-10 px-4 min-w-[90px] bg-red-600 rounded-xl flex items-center justify-center gap-2 text-white hover:bg-red-500 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale shadow-lg shadow-red-900/20 shrink-0 font-black text-[10px] tracking-widest uppercase"
                                >
                                    <span>GÖNDER</span>
                                    <Send size={14} />
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* --- CNC MACHINE BASE --- */}
                <div className="h-20 bg-[#1a1a1e] rounded-b-[2.5rem] border-x border-b border-white/10 relative overflow-hidden flex flex-col items-center justify-center shadow-3xl">
                    <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/60 via-black/20 to-transparent" />

                    {/* Branded Base Plate */}
                    <div className="bg-red-600/10 px-10 py-3 border border-red-500/10 shadow-inner rounded-2xl flex items-center justify-center group/base">
                        <img src="/logo.png" alt="TJM Base" className="h-8 object-contain transition-all duration-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.5)]" />
                    </div>

                    <div className="absolute bottom-0 w-full h-2 bg-gradient-to-t from-red-600/30 to-transparent" />
                </div>

                {/* Machine Floating Shadow */}
                <div className="h-10 w-4/5 mx-auto bg-black/50 blur-3xl rounded-full -mt-5 -z-10 group-hover:w-full group-hover:bg-red-900/20 transition-all duration-1000" />
            </div>

            {/* Fullscreen Video Modal */}
            {
                isFullscreen && displayFrame && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/98 backdrop-blur-3xl animate-in fade-in duration-500">
                        <div className="absolute top-4 right-4 md:top-10 md:right-10">
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="bg-white/5 hover:bg-red-600 text-white p-3 md:p-5 rounded-2xl md:rounded-3xl transition-all border border-white/10 shadow-2xl group/close"
                            >
                                <X size={24} className="md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <div className="w-full max-w-7xl p-2 md:p-6 animate-in zoom-in-95 duration-700">
                            <div className="relative aspect-video rounded-3xl md:rounded-[3rem] overflow-hidden border-2 md:border-4 border-white/10 shadow-[0_0_150px_rgba(220,38,38,0.2)]">
                                <img
                                    src={`data:image/jpeg;base64,${displayFrame}`}
                                    alt="CNC Feed Fullscreen"
                                    className="w-full h-full object-cover bg-black"
                                />

                                <div className="absolute bottom-2 left-2 md:bottom-10 md:left-10 bg-black/60 md:bg-black/80 backdrop-blur-md md:backdrop-blur-2xl px-3 py-1.5 md:px-8 md:py-5 rounded-xl md:rounded-[2rem] border border-white/5 md:border-white/10 shadow-2xl">
                                    <p className="text-white font-black tracking-tighter text-xs md:text-2xl uppercase italic mb-0.5 md:mb-1 flex items-center gap-1.5 md:gap-3">
                                        <img src="/logo.png" alt="TJM" className="h-3 md:h-6 object-contain hidden md:block" />
                                        {serial}
                                    </p>
                                    <div className="flex items-center gap-1.5 md:gap-3">
                                        <div className="w-1.5 h-1.5 md:w-3 md:h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.8)]"></div>
                                        <span className="text-red-500 text-[8px] md:text-xs font-black uppercase tracking-[0.1em] md:tracking-[0.3em] animate-pulse">CANLI YAYIN</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="absolute inset-0 -z-10" onClick={() => setIsFullscreen(false)}></div>
                    </div>
                )
            }

            {/* --- REMOTE DESKTOP MODAL --- */}
            {
                isRemoteViewing && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-3xl animate-in fade-in duration-500">
                        <div className="absolute top-6 right-6 md:top-10 md:right-10 flex gap-4">
                            <div className="bg-amber-500/10 border border-amber-500/20 px-6 py-3 rounded-2xl hidden md:flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-amber-500 text-xs font-black tracking-widest uppercase">MASAÜSTÜ İZLENİYOR</span>
                            </div>
                            <button
                                onClick={() => toggleRemoteView(false)}
                                className="bg-white/5 hover:bg-red-600 text-white p-3 md:p-5 rounded-2xl md:rounded-3xl transition-all border border-white/10 shadow-2xl group/close"
                            >
                                <X size={24} className="md:w-8 md:h-8 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>

                        <div className="w-full max-w-[90vw] max-h-[90vh] p-2 md:p-6 animate-in zoom-in-95 duration-700">
                            <div className="relative rounded-3xl md:rounded-[2rem] overflow-hidden border-2 md:border-4 border-white/10 shadow-[0_0_100px_rgba(245,158,11,0.15)] bg-black/40">
                                {data.desktop_frame && new Date(data.last_sync.replace(' ', 'T')).getTime() > mountTime ? (
                                    <img
                                        src={`data:image/jpeg;base64,${data.desktop_frame}`}
                                        alt="Remote Desktop Feed"
                                        className="w-full h-full object-contain cursor-crosshair"
                                    />
                                ) : (
                                    <div className="aspect-video w-full flex flex-col items-center justify-center gap-6 py-40">
                                        <Monitor className="text-amber-500/20 animate-pulse" size={80} />
                                        <p className="text-amber-500/40 text-sm font-black tracking-[0.3em] uppercase">Masaüstü Verisi Bekleniyor...</p>
                                    </div>
                                )}

                                <div className="absolute bottom-4 left-4 md:bottom-10 md:left-10 bg-black/80 backdrop-blur-2xl px-6 py-4 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-4">
                                    <Monitor size={16} className="text-amber-500" />
                                    <div>
                                        <p className="text-white text-xs font-bold leading-none">{serial} — Uzaktan İzleme</p>
                                        <p className="text-amber-500/60 text-[8px] font-black uppercase tracking-widest mt-1">Canlı Ekran Yayını (720p)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Real-time Push Notification (Toast) */}
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] transition-all duration-500 transform ${toast.visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
                <div className="bg-red-600 text-white px-6 py-4 rounded-[2rem] shadow-[0_20px_40px_rgba(220,38,38,0.4)] border border-red-500 flex items-center gap-4 backdrop-blur-xl">
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                        <MessageSquare size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Yeni Mesaj</p>
                        <p className="text-sm font-bold leading-tight">{toast.message}</p>
                    </div>
                    <button onClick={() => setToast(prev => ({ ...prev, visible: false }))} className="ml-2 hover:bg-black/10 p-1 rounded-lg transition-colors">
                        <X size={16} />
                    </button>
                </div>
            </div>
        </>
    );
}
