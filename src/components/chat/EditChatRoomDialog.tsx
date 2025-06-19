
"use client";

import { useState, useEffect, type ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Save, XCircle, ImagePlus, Edit3, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import ImageCropperDialog from "@/components/profile/ImageCropperDialog";
import { v4 as uuidv4 } from 'uuid';

interface EditChatRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  initialName: string;
  initialDescription: string;
  initialImage?: string | null;
}

export default function EditChatRoomDialog({
  isOpen,
  onClose,
  roomId,
  initialName,
  initialDescription,
  initialImage,
}: EditChatRoomDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [previewImage, setPreviewImage] = useState<string | null>(initialImage || null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [croppedRoomImageBlob, setCroppedRoomImageBlob] = useState<Blob | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
      setPreviewImage(initialImage || null);
      setCroppedRoomImageBlob(null);
      setImageToCrop(null);
    }
  }, [initialName, initialDescription, initialImage, isOpen]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({ title: "Hata", description: "Lütfen bir resim dosyası seçin.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
         toast({ title: "Hata", description: "Dosya boyutu çok büyük (Maks 5MB).", variant: "destructive" });
         return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
        setIsCropperOpen(true);
        setCroppedRoomImageBlob(null);
      };
      reader.readAsDataURL(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCropComplete = (croppedImageBlob: Blob) => {
    setCroppedRoomImageBlob(croppedImageBlob);
    setPreviewImage(URL.createObjectURL(croppedImageBlob));
    setIsCropperOpen(false);
    setImageToCrop(null);
  };

  const handleSaveChanges = async () => {
    if (!name.trim() || !description.trim()) {
      toast({ title: "Hata", description: "Oda adı ve açıklama boş olamaz.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const roomDocRef = doc(db, "chatRooms", roomId);
      const updates: { name: string; description: string; image?: string; imageAiHint?: string | null } = {
        name: name.trim(),
        description: description.trim(),
      };

      if (croppedRoomImageBlob) {
        const fileExtension = croppedRoomImageBlob.type.split('/')[1] || 'png';
        const imageFileName = `roomImage-${uuidv4()}.${fileExtension}`;
        const imageStorageRef = storageRef(storage, `chat_room_images/${roomId}/${imageFileName}`);
        
        // Eğer eski bir resim varsa (ve placeholder değilse) onu sil
        if (initialImage && !initialImage.includes('placehold.co')) {
            try {
                const oldImageRef = storageRef(storage, initialImage);
                await deleteObject(oldImageRef).catch(e => console.warn("Eski oda resmi silinirken hata (yoksayıldı):", e));
            } catch (e) {
                console.warn("Eski oda resmi referansı alınırken veya silinirken hata (yoksayıldı):", e);
            }
        }
        
        await uploadBytes(imageStorageRef, croppedRoomImageBlob);
        const downloadURL = await getDownloadURL(imageStorageRef);
        updates.image = downloadURL;
        updates.imageAiHint = null; // Özel resim yüklendiğinde ipucunu kaldır
      }

      await updateDoc(roomDocRef, updates);
      toast({ title: "Başarılı", description: "Oda ayarları güncellendi." });
      onClose();
    } catch (error) {
      console.error("Error updating room settings:", error);
      toast({ title: "Hata", description: "Oda ayarları güncellenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getAvatarFallbackText = (nameStr: string) => {
    if (nameStr) return nameStr.substring(0, 2).toUpperCase();
    return "O";
  };


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-primary" />
            <DialogTitle>Oda Ayarlarını Düzenle</DialogTitle>
          </div>
          <DialogDescription>
            Odanızın adını, açıklamasını ve resmini buradan güncelleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center space-y-2">
            <Avatar className="h-24 w-24 rounded-lg border-2 border-dashed border-border">
              {previewImage ? (
                <AvatarImage
                    src={previewImage}
                    alt={name || "Oda Resmi"}
                    className="object-cover rounded-md"
                    data-ai-hint="chat room image preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full w-full bg-muted rounded-md">
                   <ImagePlus className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <AvatarFallback className="rounded-md">{getAvatarFallbackText(name)}</AvatarFallback>
            </Avatar>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
              id="room-photo-upload"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSaving}
            >
              <ImagePlus className="mr-2 h-4 w-4" /> Resim Seç/Değiştir
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-name-edit">Oda Adı</Label>
            <Input
              id="room-name-edit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSaving}
              maxLength={50}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="room-description-edit">Açıklama</Label>
            <Textarea
              id="room-description-edit"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              disabled={isSaving}
              maxLength={150}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isSaving}>
              İptal
            </Button>
          </DialogClose>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" /> Kaydet
          </Button>
        </DialogFooter>
      </DialogContent>
      {imageToCrop && (
        <ImageCropperDialog
          isOpen={isCropperOpen}
          onClose={() => {
            setIsCropperOpen(false);
            setImageToCrop(null);
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={16/9} // Oda resimleri için daha yatay bir oran olabilir
          cropShape="rect"
        />
      )}
    </Dialog>
  );
}

    