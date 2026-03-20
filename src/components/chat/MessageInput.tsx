import { useState, useRef } from "react";
import { Send, Paperclip, X, Smile, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageWithSender } from "@/hooks/useMessages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

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
        const { error } = await supabase.storage.from("chat-attachments").upload(path, blob);
        if (error) {
          toast.error("Ошибка загрузки голосового");
          setUploading(false);
          return;
        }
        const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
        onSend("🎤 Голосовое сообщение", "voice", urlData.publicUrl, "voice.webm", blob.size);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Файл слишком большой (макс. 50 МБ)");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${conversationId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
    if (error) {
      toast.error("Ошибка загрузки файла");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
    const isImage = file.type.startsWith("image/");

    onSend(
      isImage ? "" : file.name,
      isImage ? "image" : "file",
      urlData.publicUrl,
      file.name,
      file.size
    );
    setUploading(false);
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
