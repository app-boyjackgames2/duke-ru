import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  callState: "idle" | "calling" | "ringing" | "connected" | "ended";
  callType: "audio" | "video";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  incomingCall: { from: string; fromUsername: string; callType: "audio" | "video" } | null;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  chatName: string;
}

export default function CallOverlay({
  callState,
  callType,
  localStream,
  remoteStream,
  incomingCall,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
  chatName,
}: Props) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const isMuted = localStream ? !localStream.getAudioTracks().some((t) => t.enabled) : false;
  const isVideoOff = localStream ? !localStream.getVideoTracks().some((t) => t.enabled) : true;

  if (callState === "idle") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center"
      >
        {/* Incoming call */}
        {callState === "ringing" && incomingCall && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 rounded-full duke-gradient duke-glow mx-auto flex items-center justify-center animate-pulse">
              {incomingCall.callType === "video" ? <Video className="w-10 h-10 text-primary-foreground" /> : <Phone className="w-10 h-10 text-primary-foreground" />}
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{incomingCall.fromUsername}</h2>
              <p className="text-muted-foreground text-sm mt-1">
                Входящий {incomingCall.callType === "video" ? "видеозвонок" : "аудиозвонок"}...
              </p>
            </div>
            <div className="flex gap-6">
              <Button size="lg" variant="destructive" className="rounded-full w-16 h-16" onClick={onReject}>
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button size="lg" className="rounded-full w-16 h-16 bg-duke-online hover:bg-duke-online/80" onClick={onAccept}>
                <Phone className="w-6 h-6" />
              </Button>
            </div>
          </div>
        )}

        {/* Calling */}
        {callState === "calling" && (
          <div className="text-center space-y-6">
            <div className="w-24 h-24 rounded-full duke-gradient duke-glow mx-auto flex items-center justify-center animate-pulse">
              <Phone className="w-10 h-10 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">{chatName}</h2>
              <p className="text-muted-foreground text-sm mt-1">Вызов...</p>
            </div>
            <Button size="lg" variant="destructive" className="rounded-full w-16 h-16" onClick={onEnd}>
              <PhoneOff className="w-6 h-6" />
            </Button>
          </div>
        )}

        {/* Connected */}
        {callState === "connected" && (
          <div className="flex flex-col items-center w-full h-full">
            {callType === "video" ? (
              <div className="flex-1 w-full relative">
                <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-4 right-4 w-32 h-24 rounded-xl object-cover border-2 border-border shadow-lg" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-full duke-gradient duke-glow mx-auto flex items-center justify-center mb-4">
                  <Phone className="w-10 h-10 text-primary-foreground" />
                </div>
                <h2 className="text-xl font-bold text-foreground">{chatName}</h2>
                <p className="text-muted-foreground text-sm mt-1">Разговор...</p>
                <audio ref={remoteVideoRef as any} autoPlay />
              </div>
            )}

            {/* Controls */}
            <div className="p-6 flex gap-4">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                className="rounded-full w-14 h-14"
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>
              {callType === "video" && (
                <Button
                  variant={isVideoOff ? "destructive" : "secondary"}
                  size="lg"
                  className="rounded-full w-14 h-14"
                  onClick={onToggleVideo}
                >
                  {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>
              )}
              <Button variant="destructive" size="lg" className="rounded-full w-14 h-14" onClick={onEnd}>
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
