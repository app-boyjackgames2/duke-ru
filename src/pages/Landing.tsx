import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Shield, Users, Phone, Megaphone, Download, Zap, Globe, ArrowRight } from "lucide-react";
import dukeIcon from "@/assets/duke-icon.jpeg";

const APK_URL = "https://ufxqxqgidpiviahenmsu.supabase.co/storage/v1/object/public/download//DUKE_v1.0.apk";

const features = [
  { icon: MessageSquare, title: "Мгновенные сообщения", desc: "Текст, голосовые, файлы — всё в одном месте" },
  { icon: Users, title: "Группы и каналы", desc: "Создавайте группы и публичные каналы для команд" },
  { icon: Phone, title: "Аудио/видеозвонки", desc: "WebRTC-звонки с поддержкой TURN для стабильной связи" },
  { icon: Shield, title: "Безопасность", desc: "Сквозное шифрование и надёжная аутентификация" },
  { icon: Zap, title: "Реакции и ответы", desc: "Эмодзи-реакции, ответы и пересылка сообщений" },
  { icon: Globe, title: "Работает везде", desc: "Браузер, Android — доступ с любого устройства" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <img src={dukeIcon} alt="DUKE" className="w-9 h-9 rounded-xl" />
            <span className="font-bold text-lg tracking-tight">DUKE</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#home" className="hover:text-foreground transition-colors">Home</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#download" className="hover:text-foreground transition-colors">Download</a>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Войти</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="duke-gradient">Регистрация</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm mb-8">
            <Zap className="w-3.5 h-3.5" /> Обновление 01.04.2026
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Общение без
            <span className="text-primary"> границ</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            DUKE — современный мессенджер с чатами, каналами, звонками и полной безопасностью. Бесплатно и без ограничений.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/signup">
              <Button size="lg" className="duke-gradient text-base px-8 w-full sm:w-auto">
                Начать общение <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href={APK_URL} download>
              <Button size="lg" variant="outline" className="text-base px-8 w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" /> Download Android
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Android 4.1+ • APK v1.0</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Возможности DUKE</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Всё, что нужно для комфортного и безопасного общения</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="bg-card border border-border rounded-2xl p-6 hover:border-primary/30 transition-colors group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="py-20 px-6 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <Download className="w-12 h-12 text-primary mx-auto mb-6" />
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Скачайте DUKE</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Установите DUKE на свой Android-смартфон и оставайтесь на связи в любое время.
          </p>
          <a href={APK_URL} download>
            <Button size="lg" className="duke-gradient text-base px-10">
              <Download className="w-5 h-5 mr-2" /> Скачать APK для Android
            </Button>
          </a>
          <p className="text-xs text-muted-foreground mt-4">Минимальная версия: Android 4.1+ • Размер: ~15 МБ</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <img src={dukeIcon} alt="DUKE" className="w-6 h-6 rounded-lg" />
            <span>DUKE Messenger © 2026</span>
          </div>
          <div className="flex gap-6">
            <Link to="/login" className="hover:text-foreground transition-colors">Войти</Link>
            <a href={APK_URL} download className="hover:text-foreground transition-colors">Android APK</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
