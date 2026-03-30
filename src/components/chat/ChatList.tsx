"use client";

import { useChat, Chat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Loader2, User, LifeBuoy } from "lucide-react";

const copy = {
  zh: {
    emptyTitle: "暂无会话",
    emptyHint: "你可以先发起一条留言与管理员沟通",
    supportChat: "客服留言",
    you: "你: ",
  },
  en: {
    emptyTitle: "No conversations yet",
    emptyHint: "Start by sending a message to admin support",
    supportChat: "Support",
    you: "You: ",
  },
} as const;

export function ChatList() {
  const { chats, loading, activeChat, setActiveChat, markAsRead } = useChat();
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = copy[locale];

  const getOtherParticipant = (chat: Chat) => {
    if (!user?.uid) return null;
    const otherId = chat.participants.find((p) => p !== user.uid);
    if (!otherId) return null;

    const details = chat.participantDetails?.[otherId] || {
      displayName: chat.displayName || "Unknown",
      photoURL: chat.photoURL,
      role: "employee" as const,
    };

    return {
      id: otherId,
      ...details,
    };
  };

  const handleChatClick = async (chat: Chat) => {
    setActiveChat(chat);
    await markAsRead(chat.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center px-3">
        <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
        <p className="text-sm">{t.emptyTitle}</p>
        <p className="text-xs mt-1">{t.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {chats.map((chat) => {
        const other = getOtherParticipant(chat);
        if (!other) return null;

        const isActive = activeChat?.id === chat.id;
        const isUnread =
          chat.lastMessage?.senderId !== user?.uid &&
          Boolean(chat.lastMessage?.timestamp);

        return (
          <button
            key={chat.id}
            onClick={() => handleChatClick(chat)}
            className={cn(
              "flex items-start gap-2 p-3 rounded-2xl text-left transition-colors w-full",
              isActive ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
            )}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={other.photoURL} />
              <AvatarFallback className="bg-muted">
                <User className="h-5 w-5 text-muted-foreground" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={cn("text-sm font-medium truncate", isUnread && "text-foreground")}>{other.displayName}</p>
                {chat.lastMessage?.timestamp ? (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDistanceToNow(chat.lastMessage.timestamp.toDate(), {
                      addSuffix: false,
                    })}
                  </span>
                ) : null}
              </div>

              {chat.type === "support" ? (
                <p className="text-[11px] text-emerald-600 mt-0.5 inline-flex items-center gap-1">
                  <LifeBuoy className="h-3 w-3" />
                  {t.supportChat}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {chat.opportunityTitle || " "}
                </p>
              )}

              {chat.lastMessage ? (
                <p className={cn("text-sm truncate", isUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {chat.lastMessage.senderId === user?.uid ? t.you : ""}
                  {chat.lastMessage.text}
                </p>
              ) : null}
            </div>
            {isUnread ? <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" /> : null}
          </button>
        );
      })}
    </div>
  );
}
