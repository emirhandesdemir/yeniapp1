
import { type NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with your credentials
// These should be set as environment variables in your hosting environment (e.g., Netlify)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // Ensure HTTPS URLs are returned
});

export async function POST(req: NextRequest) {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('[API Upload] Cloudinary environment variables are not set.');
    return NextResponse.json({ error: 'Cloudinary configuration missing on the server.' }, { status: 500 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('photoFile') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded or field name is not "photoFile".' }, { status: 400 });
    }

    // Validate file type (server-side)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.type || !allowedTypes.includes(file.type)) { // file.mimetype is not standard, use file.type
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.' }, { status: 400 });
    }
    
    // Validate file size (server-side, example: 5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: `File size exceeds ${maxFileSize / (1024*1024)}MB limit.` }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const uploadResult = await new Promise<{ secure_url?: string; public_id?: string; error?: any }>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' }, // You can specify folder, tags, etc. here
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result || {});
          }
        }
      );
      uploadStream.end(buffer);
    });

    if (uploadResult.error || !uploadResult.secure_url) {
      console.error('[API Upload] Cloudinary upload failed:', uploadResult.error);
      return NextResponse.json({ error: 'Failed to upload file to Cloudinary.', details: uploadResult.error?.message || 'Unknown Cloudinary error' }, { status: 500 });
    }

    console.log(`[API Upload] File successfully uploaded to Cloudinary: ${uploadResult.secure_url}`);
    return NextResponse.json({ success: true, url: uploadResult.secure_url, public_id: uploadResult.public_id }, { status: 200 });

  } catch (error: any) {
    console.error('[API Upload] Error in POST handler:', error);
    let errorMessage = 'File upload processing failed.';
    if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage, details: error.code || error.message || 'Unknown error code' }, { status: 500 });
  }
}
