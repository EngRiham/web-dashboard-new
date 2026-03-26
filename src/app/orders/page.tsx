"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, push, set, onValue, update, remove, get } from "firebase/database";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
    ImagePlus, Trash2, CheckCircle2, XCircle, RotateCcw,
    LogOut, LayoutDashboard, User as UserIcon, ShoppingCart,
    Phone, Mail, MapPin
} from "lucide-react";

type OrderStatus = "pending" | "completed" | "cancelled";

type OrderItem = {
    id: string;
    text: string;
    status: OrderStatus;
    createdAt?: number;
    imageData?: string;
    imageName?: string;
};

export default function OrdersPage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [orderText, setOrderText] = useState("");
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [sending, setSending] = useState(false);
    const [imageData, setImageData] = useState("");
    const [imageName, setImageName] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const router = useRouter();

    // Auth & Navigation
    useEffect(() => {
        return onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
            } else {
                router.push("/login");
            }
        });
    }, [router]);

    // Data Loading
    useEffect(() => {
        const ordersRef = ref(db, "orders");

        const unsubscribe = onValue(ordersRef, (snapshot) => {
            const data = snapshot.val();

            if (data) {
                const ordersArray: OrderItem[] = Object.entries(data).map(
                    ([id, value]: [string, any]) => ({
                        id,
                        ...value,
                    })
                );

                ordersArray.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setOrders(ordersArray);
            } else {
                setOrders([]);
            }

            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        router.push("/login");
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        setErrorMessage("");

        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setErrorMessage("Please select an image file.");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            setErrorMessage("Image must be smaller than 2 MB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result;
            if (typeof result === "string") {
                setImageData(result);
                setImageName(file.name);
            }
        };
        reader.readAsDataURL(file);
    };

    const clearSelectedImage = () => {
        setImageData("");
        setImageName("");
        setErrorMessage("");
    };

    const addOrder = async () => {
        if (!orderText.trim()) return;

        try {
            setSending(true);
            const cleanText = orderText.trim();

            const ordersRef = ref(db, "orders");
            const newOrderRef = push(ordersRef);

            await set(newOrderRef, {
                text: cleanText,
                status: "pending",
                createdAt: Date.now(),
                imageData: imageData || "",
                imageName: imageName || "",
            });

            await fetch("/api/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ text: cleanText }),
            });

            setOrderText("");
            clearSelectedImage();
        } catch (error) {
            console.error("Order add error:", error);
            setErrorMessage("Order could not be added.");
        } finally {
            setSending(false);
        }
    };

    const changeStatus = async (id: string, status: OrderStatus) => {
        try {
            await update(ref(db, `orders/${id}`), { status });
        } catch (error) {
            console.error("Status update error:", error);
        }
    };

    const deleteOrder = async (id: string) => {
        try {
            await remove(ref(db, `orders/${id}`));
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    const getStatusLabel = (status: OrderStatus) => {
        if (status === "completed") return "Tamamlandı";
        if (status === "cancelled") return "İptal";
        return "Bekliyor";
    };

    const getStatusClass = (status: OrderStatus) => {
        if (status === "completed") return "bg-green-500/20 text-green-400 border border-green-500/20";
        if (status === "cancelled") return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/20";
        return "bg-red-500/20 text-red-400 border border-red-500/20";
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
                    <Link href="/dashboard" className="w-full flex items-center gap-3 px-4 py-3.5 text-gray-500 hover:text-red-500 hover:bg-red-600/5 rounded-2xl transition-all font-bold text-sm tracking-wide">
                        <LayoutDashboard size={18} /> Dashboard
                    </Link>

                    <button className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-600/10 text-red-500 rounded-2xl font-bold text-sm tracking-wide">
                        <ShoppingCart size={18} /> Orders
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

                <header className="flex justify-between items-center mb-12">
                    <h1 className="text-3xl font-black tracking-wide">Orders</h1>
                </header>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-6 mb-8 shadow-lg">
                    <textarea
                        value={orderText}
                        onChange={(e) => setOrderText(e.target.value)}
                        placeholder="Write order details..."
                        className="w-full min-h-[140px] rounded-2xl bg-[#111113] border border-white/10 p-4 text-white placeholder:text-gray-500 outline-none"
                    />

                    <div className="mt-4 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                                <ImagePlus size={18} />
                                <span className="text-sm font-semibold">Attach Image</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                            
                            <button
                                onClick={addOrder}
                                disabled={sending}
                                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition font-bold"
                            >
                                {sending ? "Adding..." : "Add Order"}
                            </button>
                        </div>

                        {imageData && (
                            <div className="bg-[#111113] border border-white/10 rounded-2xl p-4 w-fit max-w-full">
                                <p className="text-xs text-gray-400 mb-3">Selected image: {imageName}</p>
                                <img
                                    src={imageData}
                                    alt="Selected preview"
                                    className="w-40 h-40 object-cover rounded-xl border border-white/10"
                                />
                                <button
                                    onClick={clearSelectedImage}
                                    className="mt-3 px-3 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-semibold transition"
                                >
                                    Remove Image
                                </button>
                            </div>
                        )}

                        {errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}
                    </div>
                </div>

                {orders.length === 0 ? (
                    <div className="border border-dashed border-white/10 rounded-3xl p-10 text-center text-gray-500">
                        No orders yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8 content-start">
                        {orders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-white/5 border border-white/10 rounded-3xl p-5 shadow-lg flex flex-col"
                            >
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <h2 className="text-lg font-bold text-white">Order</h2>
                                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${getStatusClass(order.status)}`}>
                                        {getStatusLabel(order.status)}
                                    </span>
                                </div>

                                {order.imageData && (
                                    <div className="mb-4">
                                        <img
                                            src={order.imageData}
                                            alt={order.imageName || "Order image"}
                                            className="w-full h-52 object-cover rounded-2xl border border-white/10"
                                        />
                                        {order.imageName && (
                                            <p className="text-xs text-gray-500 mt-2 truncate">{order.imageName}</p>
                                        )}
                                    </div>
                                )}

                                <p className="text-sm text-gray-200 whitespace-pre-wrap mb-5 flex-1">{order.text}</p>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => changeStatus(order.id, "completed")}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-sm font-bold transition"
                                    >
                                        <CheckCircle2 size={16} /> Tamamlandı
                                    </button>

                                    <button
                                        onClick={() => changeStatus(order.id, "cancelled")}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-bold transition"
                                    >
                                        <XCircle size={16} /> İptal
                                    </button>

                                    <button
                                        onClick={() => changeStatus(order.id, "pending")}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-bold transition"
                                    >
                                        <RotateCcw size={16} /> Bekliyor
                                    </button>

                                    <button
                                        onClick={() => deleteOrder(order.id)}
                                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-sm font-bold transition"
                                    >
                                        <Trash2 size={16} /> Sil
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer */}
                <footer className="mt-auto pt-16 border-t border-white/5">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-4">
                        <div>
                            <p className="text-[11px] font-black tracking-[0.2em] text-gray-500 uppercase mb-1">Turkish Jewellery Machine</p>
                            <p className="text-[10px] text-gray-700 tracking-widest uppercase">&copy; 2026 Tüm Hakları Saklıdır</p>
                        </div>
                        <div className="flex flex-wrap gap-x-6 gap-y-2">
                            <a href="tel:+905519492104" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                                <Phone size={11} /><span>Ofis: +90 551 949 21 04</span>
                            </a>
                            <a href="mailto:info@tjmcnc.com" className="flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-400 transition-colors">
                                <Mail size={11} /><span>info@tjmcnc.com</span>
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
