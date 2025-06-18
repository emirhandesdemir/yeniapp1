
"use client";

import { useEffect, useState, FormEvent } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, deleteDoc as deleteFirestoreDoc, query, orderBy, onSnapshot, serverTimestamp, type Timestamp } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings2 as GameSettingsIcon, ShieldAlert, Save, PlusCircle, Trash2, ListChecks } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface GameSettings {
  isGameEnabled: boolean;
  questionIntervalSeconds: number;
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  isGameEnabled: false,
  questionIntervalSeconds: 180, // 3 minutes
};

interface GameQuestionAdmin {
  id: string;
  text: string;
  answer: string;
  hint: string;
  createdAt?: Timestamp;
}

export default function AdminGameSettingsContent() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_GAME_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const { toast } = useToast();
  const { userData: adminUserData } = useAuth();

  const [gameQuestionsList, setGameQuestionsList] = useState<GameQuestionAdmin[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionAnswer, setNewQuestionAnswer] = useState("");
  const [newQuestionHint, setNewQuestionHint] = useState("");
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      if (adminUserData?.role !== 'admin') {
        setLoadingSettings(false);
        return;
      }
      setLoadingSettings(true);
      try {
        const settingsDocRef = doc(db, "appSettings", "gameConfig");
        const docSnap = await getDoc(settingsDocRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as GameSettings);
        } else {
          setSettings(DEFAULT_GAME_SETTINGS);
          toast({
            title: "Bilgi",
            description: "Oyun ayarları bulunamadı. Varsayılan ayarlar gösteriliyor. Kaydettiğinizde yeni ayarlar oluşturulacaktır.",
            variant: "default",
          });
        }
      } catch (error) {
        console.error("Error fetching game settings:", error);
        toast({
          title: "Hata",
          description: "Oyun ayarları yüklenirken bir sorun oluştu.",
          variant: "destructive",
        });
      } finally {
        setLoadingSettings(false);
      }
    };

    if (adminUserData?.role === 'admin') {
      fetchSettings();
    } else if (adminUserData !== undefined) {
      setLoadingSettings(false);
    }
  }, [adminUserData, toast]); // toast bağımlılıktan kaldırıldı

  useEffect(() => {
    if (adminUserData?.role !== 'admin') {
      setLoadingQuestions(false);
      return;
    }
    setLoadingQuestions(true);
    const q = query(collection(db, "gameQuestions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const questions: GameQuestionAdmin[] = [];
      snapshot.forEach((doc) => {
        questions.push({ id: doc.id, ...doc.data() } as GameQuestionAdmin);
      });
      setGameQuestionsList(questions);
      setLoadingQuestions(false);
    }, (error) => {
      console.error("Error fetching game questions:", error);
      toast({ title: "Hata", description: "Oyun soruları yüklenirken bir sorun oluştu.", variant: "destructive" });
      setLoadingQuestions(false);
    });
    return () => unsubscribe();
  }, [adminUserData?.role, toast]); // toast bağımlılıktan kaldırıldı

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUserData?.role !== 'admin') {
      toast({ title: "Yetki Hatası", description: "Ayarları kaydetmek için admin yetkiniz yok.", variant: "destructive" });
      return;
    }
    if (settings.questionIntervalSeconds < 30) {
        toast({ title: "Geçersiz Değer", description: "Soru aralığı en az 30 saniye olmalıdır.", variant: "destructive" });
        return;
    }

    setSavingSettings(true);
    try {
      const settingsDocRef = doc(db, "appSettings", "gameConfig");
      await setDoc(settingsDocRef, settings);
      toast({ title: "Başarılı", description: "Oyun ayarları kaydedildi." });
    } catch (error) {
      console.error("Error saving game settings:", error);
      toast({ title: "Hata", description: "Oyun ayarları kaydedilirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleAddQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!newQuestionText.trim() || !newQuestionAnswer.trim() || !newQuestionHint.trim()) {
      toast({ title: "Eksik Bilgi", description: "Lütfen tüm soru alanlarını doldurun.", variant: "destructive" });
      return;
    }
    setIsAddingQuestion(true);
    try {
      await addDoc(collection(db, "gameQuestions"), {
        text: newQuestionText.trim(),
        answer: newQuestionAnswer.trim(),
        hint: newQuestionHint.trim(),
        createdAt: serverTimestamp(),
      });
      toast({ title: "Başarılı", description: "Yeni oyun sorusu eklendi." });
      setNewQuestionText("");
      setNewQuestionAnswer("");
      setNewQuestionHint("");
    } catch (error) {
      console.error("Error adding game question:", error);
      toast({ title: "Hata", description: "Oyun sorusu eklenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsAddingQuestion(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    setIsDeletingQuestionId(questionId);
    try {
      await deleteFirestoreDoc(doc(db, "gameQuestions", questionId));
      toast({ title: "Başarılı", description: "Oyun sorusu silindi." });
    } catch (error) {
      console.error("Error deleting game question:", error);
      toast({ title: "Hata", description: "Oyun sorusu silinirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setIsDeletingQuestionId(null);
    }
  };


  if ((adminUserData === undefined || adminUserData === null) && (loadingSettings || loadingQuestions)) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-2 text-lg">Oyun ayarları ve soruları yükleniyor...</p>
      </div>
    );
  }

  if (adminUserData?.role !== 'admin' && !loadingSettings && !loadingQuestions) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="w-full max-w-md text-center p-6 shadow-lg">
          <CardHeader>
            <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle>Erişim Reddedildi</CardTitle>
            <CardDescription>Bu bölümü görüntülemek için admin yetkiniz bulunmamaktadır.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <GameSettingsIcon className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Oyun Sistemi Ayarları</CardTitle>
          </div>
          <CardDescription>Sohbet odalarındaki quiz oyununun temel ayarlarını buradan yönetin.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingSettings ? (
            <div className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Ayarlar yükleniyor...</p>
            </div>
          ) : (
            <form onSubmit={handleSaveSettings} className="space-y-6">
                <div className="flex items-center space-x-2 border p-4 rounded-md">
                <Switch
                    id="isGameEnabled"
                    checked={settings.isGameEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isGameEnabled: checked }))}
                    disabled={savingSettings}
                />
                <Label htmlFor="isGameEnabled" className="text-base">
                    Oyun Sistemini Etkinleştir
                </Label>
                </div>
                <div className="space-y-2 border p-4 rounded-md">
                <Label htmlFor="questionIntervalSeconds" className="text-base">
                    Sorular Arası Süre (saniye cinsinden)
                </Label>
                <Input
                    id="questionIntervalSeconds"
                    type="number"
                    value={settings.questionIntervalSeconds}
                    onChange={(e) => setSettings(prev => ({ ...prev, questionIntervalSeconds: parseInt(e.target.value, 10) || 0 }))}
                    min="30"
                    disabled={savingSettings || !settings.isGameEnabled}
                    className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                    Yeni bir oyun sorusunun ne kadar sürede bir sorulacağını belirler. Örn: 180 (3 dakika). Minimum 30 saniye.
                </p>
                </div>
                <div className="flex justify-end">
                <Button type="submit" disabled={savingSettings || loadingSettings}>
                    {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Ayarları Kaydet
                </Button>
                </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ListChecks className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Oyun Sorularını Yönet</CardTitle>
          </div>
          <CardDescription>Quiz oyunu için soruları, cevapları ve ipuçlarını ekleyin veya silin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddQuestion} className="space-y-4 border p-4 rounded-md mb-6">
            <h3 className="text-lg font-medium text-primary-foreground/90">Yeni Soru Ekle</h3>
            <div className="space-y-2">
              <Label htmlFor="newQuestionText">Soru Metni</Label>
              <Textarea
                id="newQuestionText"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Örn: Hangi anahtar kapı açmaz?"
                disabled={isAddingQuestion}
                rows={2}
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newQuestionAnswer">Cevap</Label>
                <Input
                  id="newQuestionAnswer"
                  value={newQuestionAnswer}
                  onChange={(e) => setNewQuestionAnswer(e.target.value)}
                  placeholder="Örn: klavye"
                  disabled={isAddingQuestion}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newQuestionHint">İpucu</Label>
                <Input
                  id="newQuestionHint"
                  value={newQuestionHint}
                  onChange={(e) => setNewQuestionHint(e.target.value)}
                  placeholder="Örn: Bilgisayarda yazı yazmak için kullanılır."
                  disabled={isAddingQuestion}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isAddingQuestion}>
                {isAddingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" />
                Soruyu Ekle
              </Button>
            </div>
          </form>

          <h3 className="text-lg font-medium text-primary-foreground/90 mb-3 mt-6">Mevcut Sorular</h3>
          {loadingQuestions ? (
            <div className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Sorular yükleniyor...</p>
            </div>
          ) : gameQuestionsList.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Henüz eklenmiş oyun sorusu bulunmamaktadır.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Soru</TableHead>
                    <TableHead>Cevap</TableHead>
                    <TableHead>İpucu</TableHead>
                    <TableHead className="text-right">Eylemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameQuestionsList.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-xs truncate" title={q.text}>{q.text}</TableCell>
                      <TableCell className="max-w-[100px] truncate" title={q.answer}>{q.answer}</TableCell>
                      <TableCell className="max-w-xs truncate" title={q.hint}>{q.hint}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={isDeletingQuestionId === q.id}>
                              {isDeletingQuestionId === q.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                               <span className="ml-1 hidden sm:inline">Sil</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Bu soruyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                <br/> <br/> Soru: <strong className="text-foreground">{q.text}</strong>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={!!isDeletingQuestionId}>İptal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteQuestion(q.id)}
                                disabled={!!isDeletingQuestionId}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                              >
                                {isDeletingQuestionId === q.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Evet, Sil
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
