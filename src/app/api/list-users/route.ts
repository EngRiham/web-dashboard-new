import { adminAuth, db } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken, unauthorizedResponse } from "@/lib/auth-middleware";

export async function GET(req: NextRequest) {
    try {
        // GÜVENLİK: Auth token doğrulaması — sadece giriş yapmış kullanıcılar erişebilir
        const user = await verifyAuthToken(req);
        if (!user) {
            return unauthorizedResponse();
        }

        const listResult = await adminAuth.listUsers(1000);

        const users = (
            await Promise.all(
                listResult.users.map(async (u) => {
                    if (!u.email) return null;

                    const machinesSnap = await db.ref(`users/${u.uid}/machines`).get();
                    const machineCount = machinesSnap.exists()
                        ? Object.keys(machinesSnap.val()).length
                        : 0;
                    const machineSerials = machinesSnap.exists()
                        ? Object.keys(machinesSnap.val())
                        : [];

                    return {
                        uid: u.uid,
                        email: u.email,
                        createdAt: u.metadata.creationTime,
                        machineCount,
                        machineSerials,
                    };
                })
            )
        ).filter((u) => u !== null);

        return NextResponse.json({ users });
    } catch (error: any) {
        console.error("API Error (list-users):", error);
        // GÜVENLİK: Detaylı hata mesajı dönme
        return NextResponse.json({ error: "Sunucu hatası oluştu.", details: error.message }, { status: 500 });
    }
}
