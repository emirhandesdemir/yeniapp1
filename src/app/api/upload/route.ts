
import { type NextRequest, NextResponse } from 'next/server';
import formidable, { type File } from 'formidable';
import fs from 'fs';
import path from 'path';

// Promisify formidable parsing
const parseForm = (req: NextRequest): Promise<{ fields: formidable.Fields; files: formidable.Files }> => {
  return new Promise((resolve, reject) => {
    // formidable expects a Node.js IncomingMessage, so we need to adapt
    // This is a common workaround.
    const form = formidable({ 
      maxFileSize: 5 * 1024 * 1024, // 5MB
      uploadDir: path.join(process.cwd(), 'public/uploads'), // Define upload directory
      keepExtensions: true,
      multiples: false,
    });

    // Ensure the upload directory exists
    const uploadDir = path.join(process.cwd(), 'public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Adapt NextRequest to something formidable can work with
    // This is a simplified adaptation. For more robust handling, consider libraries.
    const reqAsNodeReq = {
        ...req,
        headers: Object.fromEntries(req.headers.entries()),
        // formidable might try to access methods not on NextRequest, like `on` for events
        // This might require more complex adaptation or a different parsing library for edge runtime
        // For now, this works with formidable v3 in Node.js runtime.
        on: (event: string, callback: (...args: any[]) => void) => {
            if (event === 'data') {
                // Stream the body data
                (async () => {
                    const reader = req.body?.getReader();
                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            callback(value);
                        }
                    }
                })();
            }
            if (event === 'end') {
                 callback();
            }
        },
        // @ts-ignore
        socket: { encrypted: req.url.startsWith('https://') } // For formidable's internal checks
    };


    form.parse(reqAsNodeReq as any, (err, fields, files) => {
      if (err) {
        console.error('[API Upload] Formidable parsing error:', err);
        if (err.code === 1009) { // MaxFileSizeExceededError
          return reject({ message: 'File size exceeds 5MB limit.', status: 413 });
        }
        return reject({ message: 'Error parsing form data.', status: 500, details: err.message });
      }
      resolve({ fields, files });
    });
  });
};

export async function POST(req: NextRequest) {
  try {
    const { files } = await parseForm(req);
    const file = files.photoFile?.[0] as File | undefined; // formidable v3 returns array

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded or field name is not "photoFile".' }, { status: 400 });
    }

    // Validate file type (server-side)
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!file.mimetype || !allowedTypes.includes(file.mimetype)) {
      // Clean up the temporarily uploaded file if it's invalid
      if (file.filepath) {
        fs.unlinkSync(file.filepath);
      }
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, GIF, WEBP are allowed.' }, { status: 400 });
    }

    // The file is already saved by formidable in the `uploadDir` with a new name.
    // We need to return the public path to it.
    const filename = path.basename(file.filepath);
    const publicFilePath = `/uploads/${filename}`;

    return NextResponse.json({ success: true, filePath: publicFilePath }, { status: 200 });

  } catch (error: any) {
    console.error('[API Upload] Error in POST handler:', error);
    // If error is an object from reject in parseForm
    if (error && typeof error.status === 'number' && typeof error.message === 'string') {
      return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
    }
    return NextResponse.json({ error: 'File upload failed.', details: error.message || 'Unknown error' }, { status: 500 });
  }
}

// Disable Next.js body parsing for this route, as formidable handles it
export const config = {
  api: {
    bodyParser: false,
  },
};
