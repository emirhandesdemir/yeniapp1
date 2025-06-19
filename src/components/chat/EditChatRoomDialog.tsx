
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
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import Image from "next/image"; // For previewing image

interface EditChatRoomDialogProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  initialName: string;
  initialDescription: string;
  initialImage?: string | null; // Current image URL (likely placeholder)
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription);
    setPreviewImage(initialImage || null);
  }, [initialName, initialDescription, initialImage, isOpen]); // Reset form when dialog reopens with new initial data

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // For now, just show a preview. Actual upload is deferred.
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      toast({
        title: "Resim Seçildi (Önizleme)",
        description: "Gerçek resim yükleme özelliği yakında eklenecektir. Kaydettiğinizde bu resim henüz sunucuya yüklenmeyecek.",
        variant: "default"
      });
    }
  };

  const handleSaveChanges = async () => {
    if (!name.trim() || !description.trim()) {
      toast({ title: "Hata", description: "Oda adı ve açıklama boş olamaz.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const roomDocRef = doc(db, "chatRooms", roomId);
      const updates: { name: string; description: string; image?: string } = {
        name: name.trim(),
        description: description.trim(),
      };

      // Placeholder: if a new image was selected, in a real scenario you'd upload it here
      // and set updates.image = newImageURL;
      // For now, we'll just keep the initialImage if no new one is previewed,
      // or the placeholder if a new one is selected but not "uploaded"
      if (previewImage && previewImage !== initialImage) {
         // In a real implementation, this would be the new uploaded URL
         // For now, if a new image is selected, we can revert to a default placeholder or keep showing the preview
         // updates.image = previewImage; // This is just a data URI or old URL, not a Firebase Storage URL
         console.log("New image selected for room, but upload is not yet implemented. Preview: ", previewImage.substring(0,50) + "...");
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
              <AvatarFallback className="rounded-md">{name.substring(0,2).toUpperCase() || "O"}</AvatarFallback>
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
            <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3 text-blue-500"/>
                Resim yükleme özelliği henüz geliştirme aşamasındadır.
            </p>
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
    </Dialog>
  );
}
