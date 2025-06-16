
import { type NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Ensure the upload directory exists
const ensureUploadDirExists = () => {
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  if (!fs.existsSync(uploadDir)) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log(`[API Upload] Created upload directory: ${uploadDir}`);
    } catch (error) {
      console.error(`[API Upload] Failed to create upload directory: ${uploadDir}`, error);
      // If we can't create the directory, uploads will fail.
      // This error should be caught by the caller.
      throw error; 
    }
  }
};

export async function POST(req: NextRequest) {
  try {
    // Ensure directory exists before processing form data
    ensureUploadDirExists();

    const formData = await req.formData();
    const file = formData.get('photoFile') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded or field name is not "photoFile".' }, { status: 400 });
    }

    // Validate file type (server-side)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.' }, { status: 400 });
    }
    
    // Validate file size (server-side, example: 5MB)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      return NextResponse.json({ error: `File size exceeds ${maxFileSize / (1024*1024)}MB limit.` }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // IMPORTANT: Writing to `public/uploads` is generally NOT reliable or persistent
    // in serverless environments like Firebase App Hosting or Vercel.
    // Files may be lost on redeployments or instance restarts.
    // Firebase Storage is the recommended solution for persistent file storage.
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    
    // Generate a unique filename to prevent overwrites and handle special characters
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.name) || '.dat'; // Fallback extension
    const originalNameWithoutExt = path.basename(file.name, extension);
    const safeOriginalName = originalNameWithoutExt.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50);
    const filename = `${safeOriginalName}-${uniqueSuffix}${extension}`;
    const filePath = path.join(uploadDir, filename);

    try {
      fs.writeFileSync(filePath, buffer);
      console.log(`[API Upload] File successfully written to: ${filePath}`);
    } catch (writeError: any) {
      console.error('[API Upload] Error writing file to public/uploads:', writeError);
      return NextResponse.json({ error: 'Failed to save file to server.', details: writeError.message }, { status: 500 });
    }

    const publicFilePath = `/uploads/${filename}`;
    console.log(`[API Upload] File available at public path: ${publicFilePath}`);
    return NextResponse.json({ success: true, filePath: publicFilePath }, { status: 200 });

  } catch (error: any) {
    console.error('[API Upload] Error in POST handler:', error);
    let errorMessage = 'File upload processing failed.';
    if (error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    // Check for specific error types if needed, e.g. disk full, permissions
    return NextResponse.json({ error: errorMessage, details: error.code || 'Unknown error code' }, { status: 500 });
  }
}

// Note: The `export const config = { api: { bodyParser: false } };` is
// for Pages Router API routes. It's not needed for App Router API routes
// when using `req.formData()`.
