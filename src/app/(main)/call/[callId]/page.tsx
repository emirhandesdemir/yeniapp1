
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, type UserData } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, onSnapshot, updateDoc, addDoc, collection, serverTimestamp, Timestamp, deleteDoc, query, getDocs, writeBatch } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mic, MicOff, PhoneOff, UserCircle, Volume2, PhoneOutgoing, PhoneIncoming, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DirectCallData {
  callId: string;
  callerId: string;
  callerName?: string | null;
  callerAvatar?: string | null;
  calleeId: string;
  calleeName?: string | null;
  calleeAvatar?: string | null;
  status: 'initiating' | 'ringing' | 'active' | 'rejected' | 'ended' | 'missed' | 'failed';
  offerSdp?: string | null;
  answerSdp?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  endedReason?: string;
}

const STUN_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const CALL_TIMEOUT_SECONDS = 30;

export default function DirectCallPage() {
  const params = useParams();
  const router = useRouter();
  const callId = params.callId as string;
  const { currentUser, userData } = useAuth();
  const { toast } = useToast();

  const [callDetails, setCallDetails] = useState<DirectCallData | null>(null);
  const [loadingCall, setLoadingCall] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [callStatusDisplay, setCallStatusDisplay] = useState<string>("Bağlanılıyor...");
  const callStatusRef = useRef(callDetails?.status); // To avoid stale closures in timeouts

  useEffect(() => {
    callStatusRef.current = callDetails?.status;
  }, [callDetails?.status]);

  const cleanupResources = useCallback((notifyHangUp = false, reason: DirectCallData['endedReason'] = 'ended') => {
    console.log(`[CallPage ${callId}] Cleaning up resources. Notify hangup: ${notifyHangUp}, Reason: ${reason}`);
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      console.log(`[CallPage ${callId}] Local stream stopped.`);
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
      console.log(`[CallPage ${callId}] Peer connection closed.`);
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    remoteStreamRef.current = null;

    if (notifyHangUp && callId && currentUser && callDetails) {
      const callDocRef = doc(db, "directCalls", callId);
      updateDoc(callDocRef, { 
        status: reason === 'missed' ? 'missed' : (reason === 'rejected' ? 'rejected' : 'ended'), 
        endedReason: reason,
        updatedAt: serverTimestamp() 
      }).catch(err => console.error(`[CallPage ${callId}] Error updating call status to ended on cleanup:`, err));
    }
  }, [callId, currentUser, callDetails]);

  // Initialize PeerConnection
  const initializePeerConnection = useCallback(async () => {
    if (!currentUser || !callDetails || peerConnectionRef.current) return;
    console.log(`[CallPage ${callId}] Initializing PeerConnection.`);

    peerConnectionRef.current = new RTCPeerConnection(STUN_SERVERS);

    peerConnectionRef.current.onicecandidate = async (event) => {
      if (event.candidate && callId) {
        console.log(`[CallPage ${callId}] Sending ICE candidate:`, event.candidate);
        const candidatesCollection = collection(db, `directCalls/${callId}/${currentUser.uid === callDetails.callerId ? 'callerIceCandidates' : 'calleeIceCandidates'}`);
        await addDoc(candidatesCollection, event.candidate.toJSON());
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      console.log(`[CallPage ${callId}] Remote track received:`, event.streams[0]);
      if (event.streams && event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      }
    };
    
    peerConnectionRef.current.onconnectionstatechange = () => {
        if (peerConnectionRef.current) {
            console.log(`[CallPage ${callId}] PeerConnection state: ${peerConnectionRef.current.connectionState}`);
            if (peerConnectionRef.current.connectionState === 'connected') {
                 setCallStatusDisplay("Bağlı");
                 updateDoc(doc(db, "directCalls", callId), { status: 'active', updatedAt: serverTimestamp() });
            } else if (['disconnected', 'failed', 'closed'].includes(peerConnectionRef.current.connectionState)) {
                 setCallStatusDisplay("Bağlantı kesildi");
                 if (callStatusRef.current !== 'ended' && callStatusRef.current !== 'rejected' && callStatusRef.current !== 'missed') {
                    cleanupResources(true, 'connection_failed');
                 }
            }
        }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getTracks().forEach(track => peerConnectionRef.current?.addTrack(track, stream));
      console.log(`[CallPage ${callId}] Local media stream obtained and tracks added.`);
    } catch (err) {
      console.error(`[CallPage ${callId}] Error getting user media:`, err);
      toast({ title: "Mikrofon Hatası", description: "Mikrofona erişilemedi.", variant: "destructive" });
      setError("Mikrofona erişilemedi. Lütfen izinleri kontrol edin.");
      cleanupResources(true, 'failed');
      return;
    }
  }, [currentUser, callDetails, callId, toast, cleanupResources]);

  // Call Setup Effect (Offer/Answer)
  useEffect(() => {
    if (!currentUser || !callDetails || !peerConnectionRef.current || !localStreamRef.current) return;

    const pc = peerConnectionRef.current;

    const setupCall = async () => {
      if (callDetails.callerId === currentUser.uid && callDetails.status === 'initiating' && !callDetails.offerSdp) {
        // Caller: Create and send offer
        console.log(`[CallPage ${callId}] Caller creating offer.`);
        setCallStatusDisplay(`${callDetails.calleeName || 'Kullanıcı'} aranıyor...`);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          console.log(`[CallPage ${callId}] Offer created and local description set. SDP:`, offer.sdp?.substring(0,30));
          await updateDoc(doc(db, "directCalls", callId), { 
            offerSdp: offer.sdp, 
            status: 'ringing', // Move to ringing once offer is sent
            updatedAt: serverTimestamp() 
          });
        } catch (err) {
            console.error(`[CallPage ${callId}] Error creating/sending offer:`, err);
            setError("Arama başlatılamadı.");
            cleanupResources(true, 'failed');
        }
      } else if (callDetails.calleeId === currentUser.uid && callDetails.status === 'ringing' && callDetails.offerSdp && !callDetails.answerSdp) {
        // Callee: Receive offer, create and send answer
        console.log(`[CallPage ${callId}] Callee received offer, creating answer.`);
        setCallStatusDisplay(`${callDetails.callerName || 'Kullanıcı'} ile bağlantı kuruluyor...`);
        try {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: callDetails.offerSdp }));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log(`[CallPage ${callId}] Answer created and local description set. SDP:`, answer.sdp?.substring(0,30));
          await updateDoc(doc(db, "directCalls", callId), { 
            answerSdp: answer.sdp, 
            status: 'active', // Can go to active, onconnectionstatechange will confirm
            updatedAt: serverTimestamp() 
          });
        } catch (err) {
            console.error(`[CallPage ${callId}] Error processing offer/creating answer:`, err);
            setError("Çağrıya cevap verilemedi.");
            cleanupResources(true, 'failed');
        }
      }
    };

    if ((callDetails.status === 'initiating' && callDetails.callerId === currentUser.uid) || 
        (callDetails.status === 'ringing' && callDetails.calleeId === currentUser.uid)) {
      setupCall();
    }

  }, [currentUser, callDetails, initializePeerConnection, cleanupResources, callId]);
  
  // Listener for call document changes (status, answerSdp)
  useEffect(() => {
    if (!callId || !currentUser) return;
    setLoadingCall(true);

    const callDocRef = doc(db, "directCalls", callId);
    const unsubscribe = onSnapshot(callDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as DirectCallData;
        setCallDetails(data);
        console.log(`[CallPage ${callId}] Call document updated:`, data);

        if (data.status === 'ended' || data.status === 'rejected' || data.status === 'missed' || data.status === 'failed') {
          setCallStatusDisplay(
            data.status === 'rejected' ? "Çağrı reddedildi" :
            data.status === 'missed' ? "Çağrı cevapsız" :
            data.status === 'failed' ? "Çağrı başarısız" :
            "Çağrı sonlandırıldı"
          );
          cleanupResources(false); // Don't notify again if already ended
          // Optionally, add a timeout before redirecting to give user time to see status
          setTimeout(() => router.push('/friends'), 3000);
          return;
        }
        
        if (!peerConnectionRef.current && (data.status === 'initiating' || data.status === 'ringing')) {
            console.log(`[CallPage ${callId}] Initializing PC due to status: ${data.status}`);
            await initializePeerConnection(); // Ensure PC is initialized before SDP processing
        }

        const pc = peerConnectionRef.current;
        if (pc && data.answerSdp && data.callerId === currentUser.uid && pc.signalingState !== 'stable') {
          try {
            console.log(`[CallPage ${callId}] Caller received answer. Setting remote description.`);
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.answerSdp }));
          } catch (err) {
            console.error(`[CallPage ${callId}] Error setting remote description (answer):`, err);
            setError("Çağrıya bağlanılamadı (answer).");
            cleanupResources(true, 'failed');
          }
        }
        setLoadingCall(false);
      } else {
        setError("Çağrı bulunamadı veya sonlandırılmış.");
        setLoadingCall(false);
        cleanupResources(false);
        router.push('/friends');
      }
    }, (err) => {
      console.error(`[CallPage ${callId}] Error listening to call document:`, err);
      setError("Çağrı bilgileri yüklenirken bir hata oluştu.");
      setLoadingCall(false);
      cleanupResources(true, 'failed');
    });

    return () => {
      unsubscribe();
      cleanupResources(true, 'ended'); 
    };
  }, [callId, currentUser, router, initializePeerConnection, cleanupResources]);


  // ICE Candidate Listeners
  useEffect(() => {
    if (!callDetails || !peerConnectionRef.current) return;

    const pc = peerConnectionRef.current;
    const otherUserId = currentUser?.uid === callDetails.callerId ? callDetails.calleeId : callDetails.callerId;
    const candidatesCollectionPath = `directCalls/${callId}/${otherUserId === callDetails.callerId ? 'callerIceCandidates' : 'calleeIceCandidates'}`;
    
    console.log(`[CallPage ${callId}] Listening for ICE candidates from ${otherUserId} at: ${candidatesCollectionPath}`);
    const q = query(collection(db, candidatesCollectionPath));
    const unsubscribeCandidates = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const candidate = change.doc.data() as RTCIceCandidateInit;
          try {
            console.log(`[CallPage ${callId}] Received ICE candidate from ${otherUserId}:`, candidate);
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error(`[CallPage ${callId}] Error adding received ICE candidate:`, err);
          }
        }
      });
    });

    return () => unsubscribeCandidates();
  }, [callDetails, currentUser?.uid, callId]);

  // Missed call timeout for callee if still ringing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (callDetails?.status === 'ringing' && callDetails.calleeId === currentUser?.uid) {
        setCallStatusDisplay(`${callDetails.callerName || "Bilinmeyen kullanıcı"} arıyor...`);
        timeoutId = setTimeout(() => {
            if (callStatusRef.current === 'ringing') { // Check current status
                console.log(`[CallPage ${callId}] Call timed out for callee.`);
                toast({ title: "Cevapsız Çağrı", description: "Çağrıya zamanında cevap verilmedi.", variant: "destructive" });
                cleanupResources(true, 'missed');
            }
        }, CALL_TIMEOUT_SECONDS * 1000);
    }
    return () => clearTimeout(timeoutId);
  }, [callDetails, currentUser?.uid, callId, cleanupResources, toast]);


  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const handleHangUp = () => {
    console.log(`[CallPage ${callId}] Hang up initiated by ${currentUser?.uid === callDetails?.callerId ? 'caller' : 'callee'}.`);
    cleanupResources(true, currentUser?.uid === callDetails?.callerId ? 'caller_hung_up' : 'callee_hung_up');
    setCallStatusDisplay("Çağrı sonlandırılıyor...");
    // Router.push will be handled by the onSnapshot listener for status change
  };

  const getAvatarFallbackText = (name?: string | null) => {
    return name ? name.substring(0, 2).toUpperCase() : "PN";
  };

  const otherParty = currentUser?.uid === callDetails?.callerId ? 
    { name: callDetails?.calleeName, avatar: callDetails?.calleeAvatar } : 
    { name: callDetails?.callerName, avatar: callDetails?.callerAvatar };


  if (loadingCall && !callDetails) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-3 text-lg">Çağrı yükleniyor...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Çağrı Hatası</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push('/friends')}>Arkadaşlara Dön</Button>
      </div>
    );
  }
  
  if (!callDetails) { // Should be caught by loading or error, but as a fallback
     return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-destructive" />
        <p className="ml-3 text-lg text-destructive">Çağrı bilgileri alınamadı.</p>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-card via-background to-secondary/30 p-4">
      <Card className="w-full max-w-sm shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="text-center pt-8 pb-4 bg-muted/50">
          <Avatar className="h-28 w-28 mx-auto border-4 border-primary shadow-lg">
            <AvatarImage src={otherParty.avatar || `https://placehold.co/128x128.png`} data-ai-hint="user call avatar" />
            <AvatarFallback className="text-4xl">{getAvatarFallbackText(otherParty.name)}</AvatarFallback>
          </Avatar>
          <CardTitle className="mt-4 text-2xl font-bold text-foreground">{otherParty.name || "Bilinmeyen Kullanıcı"}</CardTitle>
          <p className="text-sm text-primary font-medium mt-1">
            {callStatusDisplay}
          </p>
        </CardHeader>
        <CardContent className="p-6 flex flex-col items-center space-y-6">
           <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
            {callDetails.status === 'active' && <Volume2 className="h-10 w-10 text-green-500 animate-pulse" />}
            {callDetails.status === 'ringing' && callDetails.callerId === currentUser?.uid && <PhoneOutgoing className="h-10 w-10 text-blue-500 animate-ping" />}
            {callDetails.status === 'ringing' && callDetails.calleeId === currentUser?.uid && <PhoneIncoming className="h-10 w-10 text-blue-500 animate-bounce" />}
             {['ended', 'rejected', 'missed', 'failed'].includes(callDetails.status) && <AlertTriangle className="h-10 w-10 text-destructive" />}


          <div className="flex justify-center gap-4 w-full">
            <Button
              variant={isMuted ? "destructive" : "outline"}
              size="lg"
              className="rounded-full p-4 h-16 w-16"
              onClick={handleToggleMute}
              disabled={!localStreamRef.current || callDetails.status !== 'active'}
              aria-label={isMuted ? "Sesi Aç" : "Sesi Kapat"}
            >
              {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="rounded-full p-4 h-16 w-16 bg-red-600 hover:bg-red-700"
              onClick={handleHangUp}
              disabled={['ended', 'rejected', 'missed', 'failed'].includes(callDetails.status)}
              aria-label="Çağrıyı Sonlandır"
            >
              <PhoneOff className="h-7 w-7" />
            </Button>
          </div>
        </CardContent>
      </Card>
      <Button variant="link" onClick={() => router.push('/friends')} className="mt-8 text-muted-foreground">
        Arkadaş Listesine Dön
      </Button>
    </div>
  );
}


    