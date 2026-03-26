import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type CallState = "idle" | "calling" | "ringing" | "connected" | "ended";

interface CallSignal {
  type: "offer" | "answer" | "ice-candidate" | "call-request" | "call-accept" | "call-reject" | "call-end";
  from: string;
  fromUsername?: string;
  to: string;
  payload?: any;
  callType?: "audio" | "video";
  conversationId?: string;
}

export function useWebRTC(conversationId: string | null) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: string; fromUsername: string; callType: "audio" | "video" } | null>(null);
  const [callType, setCallType] = useState<"audio" | "video">("audio");

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && channelRef.current && conversationId) {
        channelRef.current.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: {
            type: "ice-candidate",
            from: user?.id,
            payload: e.candidate.toJSON(),
          } as CallSignal,
        });
      }
    };

    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0] || null);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [user, conversationId]);

  // Subscribe to signaling channel
  useEffect(() => {
    if (!conversationId || !user) return;

    const ch = supabase.channel(`webrtc-${conversationId}`, {
      config: { broadcast: { self: false } },
    });

    ch.on("broadcast", { event: "webrtc-signal" }, ({ payload }: { payload: CallSignal }) => {
      if (!payload || payload.from === user.id) return;

      switch (payload.type) {
        case "call-request":
          if (payload.to === user.id || !payload.to) {
            setIncomingCall({
              from: payload.from,
              fromUsername: payload.fromUsername || "Пользователь",
              callType: payload.callType || "audio",
            });
            setCallState("ringing");
          }
          break;

        case "call-accept":
          handleCallAccepted();
          break;

        case "call-reject":
        case "call-end":
          endCall();
          break;

        case "offer":
          handleOffer(payload.payload);
          break;

        case "answer":
          handleAnswer(payload.payload);
          break;

        case "ice-candidate":
          handleIceCandidate(payload.payload);
          break;
      }
    });

    ch.subscribe();
    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [conversationId, user]);

  const getMediaStream = async (type: "audio" | "video") => {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === "video",
    });
  };

  const startCall = async (type: "audio" | "video", targetUserId?: string) => {
    if (!user || !conversationId || !channelRef.current) return;

    setCallType(type);
    setCallState("calling");

    const stream = await getMediaStream(type);
    setLocalStream(stream);

    // Send call request
    channelRef.current.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        type: "call-request",
        from: user.id,
        fromUsername: "",
        to: targetUserId || "",
        callType: type,
        conversationId,
      } as CallSignal,
    });
  };

  const handleCallAccepted = async () => {
    if (!channelRef.current || !user) return;

    const pc = createPeerConnection();
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    channelRef.current.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        type: "offer",
        from: user.id,
        to: "",
        payload: offer,
      } as CallSignal,
    });

    setCallState("connected");
  };

  const acceptCall = async () => {
    if (!incomingCall || !channelRef.current || !user) return;

    setCallType(incomingCall.callType);

    const stream = await getMediaStream(incomingCall.callType);
    setLocalStream(stream);

    channelRef.current.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        type: "call-accept",
        from: user.id,
        to: incomingCall.from,
      } as CallSignal,
    });

    setIncomingCall(null);
    setCallState("connected");
  };

  const rejectCall = () => {
    if (!channelRef.current || !user || !incomingCall) return;

    channelRef.current.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        type: "call-reject",
        from: user.id,
        to: incomingCall.from,
      } as CallSignal,
    });

    setIncomingCall(null);
    setCallState("idle");
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (!channelRef.current || !user) return;

    const pc = createPeerConnection();
    if (localStream) {
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        type: "answer",
        from: user.id,
        to: "",
        payload: answer,
      } as CallSignal,
    });
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (pcRef.current) {
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    }
  };

  const endCall = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setCallState("idle");
    setIncomingCall(null);

    if (channelRef.current && user) {
      channelRef.current.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: {
          type: "call-end",
          from: user.id,
          to: "",
        } as CallSignal,
      });
    }
  }, [localStream, user]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    }
  };

  return {
    callState,
    callType,
    localStream,
    remoteStream,
    incomingCall,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
  };
}
