
import { type NextRequest, NextResponse } from 'next/server';

// This API route is intentionally left non-functional after reverting Cloudinary.
// If a new file upload system is implemented, this route should be updated accordingly.

export async function POST(req: NextRequest) {
  console.warn('[API Upload] File upload route is called, but the upload system is not configured.');
  return NextResponse.json(
    { error: 'File upload service is not currently configured. Please contact support or an administrator.' },
    { status: 501 } // 501 Not Implemented
  );
}
