import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  initials: string;
  tone?: string;
  size?: string;
  photoUrl?: string | null;
}

export function UserAvatar({ initials, tone = "bg-slate-900", size = "h-10 w-10", photoUrl }: UserAvatarProps) {
  const src = resolveMediaUrl(photoUrl);

  return (
    <Avatar className={cn(size, "shadow-sm")}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className={cn(tone, "text-white font-bold")}>{initials}</AvatarFallback>
    </Avatar>
  );
}
