
"use client";

import React, { useState, useCallback } from 'react';
import Cropper, { type Area, type Point } from 'react-easy-crop';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { RotateCcw, ZoomIn, ZoomOut, CropIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageCropperDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string | null;
  onCropComplete: (croppedImageBlob: Blob) => void;
  aspectRatio?: number; // e.g., 1 for square, 16/9 for landscape
  cropShape?: 'rect' | 'round';
}

// Helper function to create an image element
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); //Needed for CORS
    image.src = url;
  });

// Helper function to get the cropped image as a Blob
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
): Promise<Blob | null> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty');
        reject(new Error('Kırpılmış resim oluşturulamadı.'));
        return;
      }
      resolve(blob);
    }, 'image/png', 0.9); // Output as PNG, quality 0.9
  });
}


export default function ImageCropperDialog({
  isOpen,
  onClose,
  imageSrc,
  onCropComplete,
  aspectRatio = 1, // Default to square for profile pictures
  cropShape = 'round', // Default to round for profile pictures
}: ImageCropperDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const { toast } = useToast();

  const onCropProcess = useCallback((croppedArea: Area, currentCroppedAreaPixels: Area) => {
    setCroppedAreaPixels(currentCroppedAreaPixels);
  }, []);

  const handleCrop = async () => {
    if (!imageSrc || !croppedAreaPixels) {
      toast({ title: "Hata", description: "Kırpılacak resim veya alan bulunamadı.", variant: "destructive" });
      return;
    }
    try {
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      if (croppedImageBlob) {
        onCropComplete(croppedImageBlob);
        onClose();
      } else {
        toast({ title: "Hata", description: "Resim kırpılamadı.", variant: "destructive" });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "Kırpma Hatası", description: "Resim işlenirken bir sorun oluştu.", variant: "destructive" });
    }
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg p-0 max-h-[90vh] flex flex-col">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle>Resmi Kırp</DialogTitle>
          <DialogDescription>
            Profil fotoğrafınızı ayarlayın. Yakınlaştırabilir ve sürükleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="relative h-[300px] sm:h-[400px] w-full bg-muted overflow-hidden">
          {imageSrc && (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              cropShape={cropShape}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropProcess}
              showGrid={false}
              zoomSpeed={0.1}
              classes={{
                containerClassName: 'rounded-md',
              }}
            />
          )}
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center space-x-2">
            <ZoomOut className="h-5 w-5 text-muted-foreground" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.01}
              onValueChange={(value) => setZoom(value[0])}
              aria-label="Yakınlaştırma"
            />
            <ZoomIn className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
        <DialogFooter className="p-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">İptal</Button>
          </DialogClose>
          <Button onClick={handleCrop} className="bg-primary hover:bg-primary/90">
            <CropIcon className="mr-2 h-4 w-4" /> Kırp ve Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
