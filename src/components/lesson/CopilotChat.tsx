import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { CopilotoMode } from "@/hooks/useEntitlements";

type Msg = { role: "user" | "assistant"; content: string };

interface LessonContext {
  theme?: string | null;
  learningOutcome?: string | null;
  canonOperation?: string | null;
  canonEvidence?: string | null;
  briefFocus?: string | null;
  briefDynamic?: string | null;
  depthLevel?: string | null;
  teachingStatus?: string | null;
  readingStatus?: string | null;
  subject?: string | null;
  yearLevel?: number | null;
  curriculumNodeNames?: string[];
  bibliographyNames?: string[];
  authorizedSourceTitles?: string[];
}

interface CopilotChatProps {
  lessonContext: LessonContext;
  copilotoMode: CopilotoMode;
  placeholder?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/copilot-chat`;

async function streamChat({
  messages,
  lessonContext,
  onDelta,
  onDone,
  onError,
}: {
  messages: Msg[];
  lessonContext: LessonContext;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, lessonContext }),
  });

  if (!resp.ok) {
    let errorMsg = "Error al conectar con el copiloto";
    try {
      const errData = await resp.json();
      errorMsg = errData.error || errorMsg;
    } catch { /* ignore */ }
    onError(errorMsg);
    return;
  }

  if (!resp.body) {
    onError("Sin respuesta del servidor");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch { /* ignore */ }
    }
  }

  onDone();
}

export default function CopilotChat({ lessonContext, copilotoMode, placeholder = "Preguntá algo sobre tu clase..." }: CopilotChatProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPremium = copilotoMode === "full";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Msg = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setError(null);

    let assistantSoFar = "";
    const upsertAssistant = (nextChunk: string) => {
      assistantSoFar += nextChunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      await streamChat({
        messages: [...messages, userMsg],
        lessonContext,
        onDelta: upsertAssistant,
        onDone: () => setIsLoading(false),
        onError: (msg) => {
          setError(msg);
          setIsLoading(false);
        },
      });
    } catch (e) {
      console.error(e);
      setError("Error inesperado al comunicarse con el copiloto");
      setIsLoading(false);
    }
  };

  if (!isPremium) {
    return (
      <Alert>
        <Lock className="h-4 w-4" />
        <AlertDescription className="text-xs">
          El chat del copiloto está disponible en el plan Premium.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ScrollArea className="h-[300px] rounded-xl border border-border/70 bg-background p-3" ref={scrollRef}>
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">
            {placeholder}
          </p>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-xl px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 bg-primary/10 text-foreground"
                  : "mr-4 bg-muted/50 text-foreground"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="mr-4 rounded-xl bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground animate-pulse">Pensando...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex gap-2"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="text-sm h-9"
        />
        <Button type="submit" size="sm" disabled={isLoading || !input.trim()} className="h-9 px-3">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
