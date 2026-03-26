"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
    const [isLight, setIsLight] = useState(false);

    useEffect(() => {
        // İlk yüklemede kullanıcının tercihini kontrol et
        const storedTheme = localStorage.getItem("theme");
        if (storedTheme === "light") {
            setIsLight(true);
            document.documentElement.classList.add("theme-light");
        } else {
            document.documentElement.classList.remove("theme-light");
        }
    }, []);

    const toggleTheme = () => {
        const root = document.documentElement;
        if (isLight) {
            root.classList.remove("theme-light");
            localStorage.setItem("theme", "dark");
            setIsLight(false);
        } else {
            root.classList.add("theme-light");
            localStorage.setItem("theme", "light");
            setIsLight(true);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className={`absolute top-6 right-6 sm:top-8 sm:right-8 z-50 p-3 sm:p-4 rounded-full shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 border ${isLight ? 'bg-amber-100 border-amber-300 text-amber-600 shadow-amber-900/20' : 'bg-[#1a1a1e] border-white/10 text-white shadow-black/50 hover:bg-white/5'}`}
            title={isLight ? "Karanlık Moda Geç" : "Aydınlık Moda Geç"}
        >
            {isLight ? (
                <Moon size={22} className="animate-in fade-in zoom-in spin-in" strokeWidth={2.5} />
            ) : (
                <Sun size={22} className="animate-in fade-in zoom-in spin-in" strokeWidth={2.5} />
            )}
        </button>
    );
}
