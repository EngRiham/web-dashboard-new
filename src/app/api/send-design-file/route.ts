import { NextResponse } from "next/server";
import ImageKit from "imagekit";
import { db } from "@/lib/firebase"; // Ensure firebase is initialized on server or we use rest API

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ""
});

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const serial = formData.get("serial") as string | null;

        if (!file || !serial) {
            return NextResponse.json(
                { success: false, message: "File or serial missing" },
                { status: 400 }
            );
        }

        const fileName = file.name;
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Upload to ImageKit in temp folder
        const uploadRes = await imagekit.upload({
            file: buffer,
            fileName: fileName,
            folder: `/temp_designs/${serial}/`,
            useUniqueFileName: true
        });

        // We use Firebase REST API directly here since we run on Edge/Node without admin SDK sometimes
        const firebaseBaseUrl = "https://cnc-monitor-new-default-rtdb.europe-west1.firebasedatabase.app";
        // Actually, we can use the firebase app if initialized properly, but fetching is safer on Next.js serverless
        const tokenResp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
             method: 'POST', body: JSON.stringify({ token: "admin" })
        }).catch(() => null);

        // Better to use the frontend to write to Firebase, but since we are in API, 
        // we will just return the upload details to the frontend and let the frontend do the Firebase saving!
        // This is much safer and easier than trying to auth Firebase Admin SDK here.

        return NextResponse.json({
            success: true,
            url: uploadRes.url,
            fileId: uploadRes.fileId,
            fileName: fileName,
            message: "File temporarily stored"
        });
    } catch (error) {
        console.error("send-design-file error:", error);
        return NextResponse.json({ success: false, message: "Upload failed" }, { status: 500 });
    }
}
