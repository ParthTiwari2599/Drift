import { NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";

export async function POST(req: Request) {
  console.log("UPLOAD HIT");

  console.log("ENV CHECK", {
    name: process.env.CLOUDINARY_CLOUD_NAME,
    key: process.env.CLOUDINARY_API_KEY ? "OK" : "MISSING",
    secret: process.env.CLOUDINARY_API_SECRET ? "OK" : "MISSING",
  });

  try {
    const body = await req.json();
    const { file } = body;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const uploadResponse = await cloudinary.uploader.upload(file, {
      folder: "drift-chat",
      resource_type: body.resourceType || "image", // Allow specifying resource type
    });

    return NextResponse.json({
      success: true,
      url: uploadResponse.secure_url,
      public_id: uploadResponse.public_id,
    });

    // Mock response for testing
    // return NextResponse.json({
    //   success: true,
    //   url: "https://via.placeholder.com/300",
    //   public_id: "test",
    // });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}