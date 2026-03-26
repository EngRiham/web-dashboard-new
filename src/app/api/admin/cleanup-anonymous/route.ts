import { adminAuth } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        let deletedCount = 0;
        let totalUsers = 0;

        const cleanup = async (nextPageToken?: string) => {
            const listResult = await adminAuth.listUsers(1000, nextPageToken);
            totalUsers += listResult.users.length;

            const deletePromises = listResult.users.map(async (user) => {
                // Daha esnek filtre: Email yoksa ve telefon yoksa anonimdir
                if (!user.email && !user.phoneNumber) {
                    try {
                        await adminAuth.deleteUser(user.uid);
                        deletedCount++;
                    } catch (e: any) {
                        // ignore already deleted
                    }
                }
            });

            await Promise.all(deletePromises);

            if (listResult.pageToken) {
                await cleanup(listResult.pageToken);
            }
        };

        await cleanup();

        return NextResponse.json({
            success: true,
            message: `${deletedCount} adet anonim kullanıcı süpürüldü.`,
            scanned: totalUsers
        });
    } catch (error: any) {
        console.error("Cleanup Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
