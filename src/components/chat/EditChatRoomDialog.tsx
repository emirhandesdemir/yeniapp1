
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
import { Loader2, Save, XCircle, ImagePlus, Edit3, Info, Gamepad2 } from "lucide-react"; // Gamepad2 eklendi
import { useToast } from "@/hooks/use-toast";
import { db, storage } from "@/lib/firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore"; // getDoc eklendi
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import ImageCropperDialog from "@/components/profile/ImageCropperDialog";
import { v4 as uuidv4 } from 'uuid';
import { Switch } from "@/components/ui/switch"; // Switch eklendi

interface EditChatRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  initialName: string;
  initialDescription: string;
  initialImage?: string | null;
  initialIsGameEnabledInRoom?: boolean; // Eklendi
}

export default function EditChatRoomDialog({
  isOpen,
  onClose,
  roomId,
  initialName,
  initialDescription,
  initialImage,
  initialIsGameEnabledInRoom, // Eklendi
}: EditChatRoomDialogProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isGameEnabled, setIsGameEnabled] = useState(initialIsGameEnabledInRoom ?? true); // Eklendi
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
      setIsGameEnabled(initialIsGameEnabledInRoom ?? true); // Varsayılanı true yapabilir veya globalden alabiliriz
      setCroppedRoomImageBlob(null);
      setImageToCrop(null);

      // Eğer initialIsGameEnabledInRoom prop'u gelmiyorsa, odanın mevcut durumunu Firestore'dan çek
      if (initialIsGameEnabledInRoom === undefined) {
        const fetchRoomGameStatus = async () => {
            try {
                const roomDocRef = doc(db, "chatRooms", roomId);
                const roomSnap = await getDoc(roomDocRef);
                if (roomSnap.exists()) {
                    setIsGameEnabled(roomSnap.data()?.isGameEnabledInRoom ?? true);
                }
            } catch (error) {
                console.error("Error fetching room game status for edit dialog:", error);
            }
        };
        fetchRoomGameStatus();
      }

    }
  }, [isOpen, initialName, initialDescription, initialImage, initialIsGameEnabledInRoom, roomId]);

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
      const updates: { name: string; description: string; image?: string; imageAiHint?: string | null; isGameEnabledInRoom: boolean; } = { // isGameEnabledInRoom eklendi
        name: name.trim(),
        description: description.trim(),
        isGameEnabledInRoom: isGameEnabled, // Eklendi
      };

      if (croppedRoomImageBlob) {
        const fileExtension = croppedRoomImageBlob.type.split('/')[1] || 'png';
        const imageFileName = `roomImage-${uuidv4()}.${fileExtension}`;
        const imageStorageRef = storageRef(storage, `chat_room_images/${roomId}/${imageFileName}`);

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
        updates.imageAiHint = null;
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
            Odanızın adını, açıklamasını, resmini ve oyun ayarlarını buradan güncelleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
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
          <div className="space-y-2 border p-3 rounded-md bg-muted/20">
            <div className="flex items-center justify-between">
                <Label htmlFor="isGameEnabledSwitch" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Gamepad2 className="h-4 w-4 text-primary" />
                    Oyun Sistemini Etkinleştir
                </Label>
                <Switch
                    id="isGameEnabledSwitch"
                    checked={isGameEnabled}
                    onCheckedChange={setIsGameEnabled}
                    disabled={isSaving}
                />
            </div>
            <p className="text-xs text-muted-foreground">
                Bu ayar, odanızda soru-cevap oyununun aktif olup olmayacağını belirler.
            </p>
          </div>
        </div>
        <DialogFooter className="pt-4 border-t">
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
          aspectRatio={16/9}
          cropShape="rect"
        />
      )}
    </Dialog>
  );
}
