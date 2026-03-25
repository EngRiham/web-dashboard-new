"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, push, set, onValue, update, remove } from "firebase/database";
import { ImagePlus, Trash2, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

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
    const [orderText, setOrderText] = useState("");
    const [orders, setOrders] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [imageData, setImageData] = useState("");
    const [imageName, setImageName] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

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

    return (
        <div className="min-h-screen bg-[#0a0a0b] text-white p-6 md:p-10">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-black mb-8 tracking-wide">Orders</h1>

                <div className="bg-white/5 border border-white/10 rounded-3xl p-5 md:p-6 mb-8 shadow-lg">
                    <textarea
                        value={orderText}
                        onChange={(e) => setOrderText(e.target.value)}
                        placeholder="Write order details..."
                        className="w-full min-h-[140px] rounded-2xl bg-[#111113] border border-white/10 p-4 text-white placeholder:text-gray-500 outline-none"
                    />

                    <div className="mt-4 flex flex-col gap-4">
                        <div>
                            <label className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition">
                                <ImagePlus size={18} />
                                <span className="text-sm font-semibold">Attach Image</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
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

                        <div>
                            <button
                                onClick={addOrder}
                                disabled={sending}
                                className="px-5 py-3 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition font-bold"
                            >
                                {sending ? "Adding..." : "Add Order"}
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <p className="text-gray-400">Loading...</p>
                ) : orders.length === 0 ? (
                    <div className="border border-dashed border-white/10 rounded-3xl p-10 text-center text-gray-500">
                        No orders yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
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
            </div>
        </div>
    );
}
