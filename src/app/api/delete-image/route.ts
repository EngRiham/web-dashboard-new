import { NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ""
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fileId } = body;

        if (!fileId) {
            return NextResponse.json(
                { success: false, message: "fileId is missing" },
                { status: 400 }
            );
        }

        await new Promise((resolve, reject) => {
            imagekit.deleteFile(fileId, function(error, result) {
                if (error) {
                    console.error("ImageKit delete error:", error);
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
        });

        return NextResponse.json({
            success: true,
            message: "File deleted successfully from ImageKit"
        });
    } catch (error) {
        console.error("delete-image error:", error);
        return NextResponse.json({ success: false, message: "Failed to delete file" }, { status: 500 });
    }
}
