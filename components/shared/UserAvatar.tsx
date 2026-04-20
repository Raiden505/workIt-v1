interface UserAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}

function getInitials(name?: string | null): string {
  if (!name) {
    return "?";
  }

  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function UserAvatar({ src, name, size = "md" }: UserAvatarProps) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-sm" : "h-10 w-10 text-sm";

  if (src) {
    return (
      <img
        src={src}
        alt={name ? `${name} avatar` : "User avatar"}
        className={`${sizeClass} rounded-full border border-emerald-300 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 font-semibold text-emerald-900`}
      aria-label={name ? `${name} avatar` : "User avatar"}
    >
      {getInitials(name)}
    </div>
  );
}
