import { useState, useRef } from "react";
import { Send, Paperclip, X, Smile, Mic, Square, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageWithSender } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/chat-attachments";
import { uploadAttachment } from "@/lib/resilient-upload";
import { Progress } from "@/components/ui/progress";

interface Props {
  onSend: (content: string, type?: string, fileUrl?: string, fileName?: string, fileSize?: number) => void;
  replyTo: MessageWithSender | null;
  onCancelReply: () => void;
  conversationId: string;
  onTyping?: () => void;
}

export default function MessageInput({ onSend, replyTo, onCancelReply, conversationId, onTyping }: Props) {
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadPathRef = useRef<string | null>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    onTyping?.();
  };

  const handleEmojiSelect = (emoji: any) => {
    setText((prev) => prev + emoji.native);
    setEmojiOpen(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) return;

        setUploading(true);
        const path = `${conversationId}/${Date.now()}.webm`;
        try {
          await uploadAttachment({ path, file: blob, contentType: blob.type, onXhr: (xhr) => { xhrRef.current = xhr; }, onProgress: ({ percent }) => setUploadProgress(percent) });
        } catch {
          toast.error("Ошибка загрузки голосового");
          setUploading(false);
          return;
        }
        onSend("🎤 Голосовое сообщение", "voice", path, "voice.webm", blob.size);
        setUploading(false);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      toast.error("Нет доступа к микрофону");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const uploadFile = async (file: File) => {
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 50 МБ)");
      setUploading(false); return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = uploadPathRef.current || `${conversationId}/${crypto.randomUUID()}.${ext}`;
    uploadPathRef.current = path;
    try {
      await uploadAttachment({
        path, file, contentType: file.type,
        onXhr: (xhr) => { xhrRef.current = xhr; },
        onProgress: ({ percent }) => setUploadProgress(percent),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") toast.info("Загрузка отменена");
      else { toast.error("Ошибка загрузки файла. Можно повторить."); setFailedFile(file); }
      setUploading(false);
      return;
    }

    const isImage = file.type.startsWith("image/");

    onSend(
      isImage ? "" : file.name,
      isImage ? "image" : "file",
      path,
      file.name,
      file.size
    );
    setUploading(false);
    setUploadProgress(0);
    setFailedFile(null);
    uploadPathRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    uploadPathRef.current = null;
    setFailedFile(null);
    setUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="border-t border-border bg-card/50 backdrop-blur-sm">
      {replyTo && (
        <div className="px-4 pt-3 flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-lg px-3 py-2 border-l-2 border-primary">
            <p className="text-xs text-primary font-medium">{replyTo.sender?.username}</p>
            <p className="text-xs text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={onCancelReply}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
      {(uploading || failedFile) && (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">{failedFile?.name || "Загрузка вложения"}</span>
            {failedFile && <Button size="sm" variant="ghost" className="h-7" onClick={() => void uploadFile(failedFile)}><RefreshCw className="mr-1 h-3.5 w-3.5" />Повторить</Button>}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelUpload}><X className="h-4 w-4" /></Button>
          </div>
          {uploading && <Progress value={uploadProgress} className="mt-2 h-1.5" />}
        </div>
      )}

      <div className="p-3 flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept="image/*,application/pdf,.doc,.docx,.txt,.zip,.rar"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || recording}
        >
          <Paperclip className="w-4 h-4" />
        </Button>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground flex-shrink-0"
              disabled={recording}
            >
              <Smile className="w-4 h-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 border-border" side="top" align="start">
            <Picker
              data={data}
              onEmojiSelect={handleEmojiSelect}
              theme="dark"
              locale="ru"
              previewPosition="none"
              skinTonePosition="none"
            />
          </PopoverContent>
        </Popover>

        {recording ? (
          <>
            <div className="flex-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-sm text-destructive font-medium">Запись...</span>
            </div>
            <Button
              size="icon"
              variant="destructive"
              className="h-9 w-9 flex-shrink-0"
              onClick={stopRecording}
            >
              <Square className="w-4 h-4" />
            </Button>
          </>
        ) : (
          <>
            <Input
              placeholder="Сообщение..."
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="bg-muted border-0 h-9 text-sm"
              disabled={uploading}
            />
            {text.trim() ? (
              <Button
                size="icon"
                className="h-9 w-9 duke-gradient flex-shrink-0"
                onClick={handleSend}
                disabled={uploading}
              >
                <Send className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={startRecording}
                disabled={uploading}
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
