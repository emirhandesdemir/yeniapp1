
"use client";

import { useEffect, useState, FormEvent, useCallback } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, setDoc, collection, addDoc, deleteDoc as deleteFirestoreDoc, query, orderBy, onSnapshot, serverTimestamp, type Timestamp, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings2 as GameSettingsIcon, ShieldAlert, Save, PlusCircle, Trash2, ListChecks, Puzzle } from "lucide-react";
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
  }, [adminUserData, toast]); 

  const fetchGameQuestions = useCallback(async () => {
    if (adminUserData?.role !== 'admin') {
      setLoadingQuestions(false);
      return;
    }
    setLoadingQuestions(true);
    try {
      const q = query(collection(db, "gameQuestions"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const questions: GameQuestionAdmin[] = [];
      snapshot.forEach((doc) => {
        questions.push({ id: doc.id, ...doc.data() } as GameQuestionAdmin);
      });
      setGameQuestionsList(questions);
    } catch (error) {
      console.error("Error fetching game questions with getDocs:", error);
      toast({ title: "Hata", description: "Oyun soruları yüklenirken bir sorun oluştu.", variant: "destructive" });
    } finally {
      setLoadingQuestions(false);
    }
  }, [adminUserData?.role, toast]);

  useEffect(() => {
    fetchGameQuestions();
  }, [fetchGameQuestions]);


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
      fetchGameQuestions(); // Refresh list after adding
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
      fetchGameQuestions(); // Refresh list after deleting
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
      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-4">
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
            <form onSubmit={handleSaveSettings} className="space-y-4">
                <div className="flex items-center space-x-3 border p-3 rounded-md bg-muted/20">
                <Switch
                    id="isGameEnabled"
                    checked={settings.isGameEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, isGameEnabled: checked }))}
                    disabled={savingSettings}
                />
                <Label htmlFor="isGameEnabled" className="text-sm font-medium cursor-pointer">
                    Oyun Sistemini Etkinleştir
                </Label>
                </div>
                <div className="space-y-1.5 border p-3 rounded-md bg-muted/20">
                <Label htmlFor="questionIntervalSeconds" className="text-sm font-medium">
                    Sorular Arası Süre (saniye)
                </Label>
                <Input
                    id="questionIntervalSeconds"
                    type="number"
                    value={settings.questionIntervalSeconds}
                    onChange={(e) => setSettings(prev => ({ ...prev, questionIntervalSeconds: parseInt(e.target.value, 10) || 0 }))}
                    min="30"
                    disabled={savingSettings || !settings.isGameEnabled}
                    className="max-w-xs h-9"
                />
                <p className="text-xs text-muted-foreground">
                    Yeni bir oyun sorusunun sorulma aralığı. Örn: 180 (3 dakika). Minimum 30 sn.
                </p>
                </div>
                <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingSettings || loadingSettings} size="sm">
                    {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Ayarları Kaydet
                </Button>
                </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-sm border-border/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Puzzle className="h-7 w-7 text-primary" />
            <CardTitle className="text-2xl font-headline">Oyun Sorularını Yönet</CardTitle>
          </div>
          <CardDescription>Quiz oyunu için soruları, cevapları ve ipuçlarını ekleyin veya silin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddQuestion} className="space-y-3 border p-3 rounded-md mb-6 bg-muted/20">
            <h3 className="text-md font-medium text-foreground/90">Yeni Soru Ekle</h3>
            <div className="space-y-1.5">
              <Label htmlFor="newQuestionText" className="text-xs">Soru Metni</Label>
              <Textarea
                id="newQuestionText"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                placeholder="Örn: Hangi anahtar kapı açmaz?"
                disabled={isAddingQuestion}
                rows={2}
                required
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="newQuestionAnswer" className="text-xs">Cevap</Label>
                <Input
                  id="newQuestionAnswer"
                  value={newQuestionAnswer}
                  onChange={(e) => setNewQuestionAnswer(e.target.value)}
                  placeholder="Örn: klavye"
                  disabled={isAddingQuestion}
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newQuestionHint" className="text-xs">İpucu</Label>
                <Input
                  id="newQuestionHint"
                  value={newQuestionHint}
                  onChange={(e) => setNewQuestionHint(e.target.value)}
                  placeholder="Örn: Bilgisayarda yazı yazmak için kullanılır."
                  disabled={isAddingQuestion}
                  required
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={isAddingQuestion} size="sm">
                {isAddingQuestion && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <PlusCircle className="mr-2 h-4 w-4" />
                Soruyu Ekle
              </Button>
            </div>
          </form>

          <h3 className="text-md font-medium text-foreground/90 mb-2 mt-4">Mevcut Sorular ({gameQuestionsList.length})</h3>
          {loadingQuestions ? (
            <div className="flex justify-center items-center py-6">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Sorular yükleniyor...</p>
            </div>
          ) : gameQuestionsList.length === 0 ? (
            <p className="text-muted-foreground text-center py-4 text-sm">Henüz eklenmiş oyun sorusu bulunmamaktadır.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Soru</TableHead>
                    <TableHead className="text-xs">Cevap</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">İpucu</TableHead>
                    <TableHead className="text-right text-xs">Eylemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gameQuestionsList.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-xs truncate text-xs" title={q.text}>{q.text}</TableCell>
                      <TableCell className="max-w-[100px] truncate text-xs" title={q.answer}>{q.answer}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs hidden md:table-cell" title={q.hint}>{q.hint}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="xs" className="h-7 px-2" disabled={isDeletingQuestionId === q.id}>
                              {isDeletingQuestionId === q.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                               <span className="ml-1 hidden sm:inline">Sil</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="sm:max-w-md">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                              <AlertDialogDescription className="text-sm">
                                Bu soruyu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                                <br/> <br/> Soru: <strong className="text-foreground">{q.text}</strong>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={!!isDeletingQuestionId} size="sm">İptal</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteQuestion(q.id)}
                                disabled={!!isDeletingQuestionId}
                                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                                size="sm"
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
