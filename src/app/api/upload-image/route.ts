import { NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ""
});

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folder = formData.get("folder") as string | null;
        const fileName = formData.get("fileName") as string | null;

        if (!file || !folder) {
            return NextResponse.json(
                { success: false, message: "file or folder missing" },
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const response = await imagekit.upload({
            file: buffer,
            fileName: fileName || file.name || "image.jpg",
            folder: folder,
            useUniqueFileName: !fileName
        });

        return NextResponse.json({
            success: true,
            url: response.url,
            fileId: response.fileId
        });
    } catch (error) {
        console.error("upload-image error:", error);
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
