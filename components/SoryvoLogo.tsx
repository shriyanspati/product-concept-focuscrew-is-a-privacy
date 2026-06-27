import Image from "next/image";

type SoryvoLogoProps = {
  variant?: "full" | "mark";
  size?: number;
  className?: string;
  priority?: boolean;
  alt?: string;
};

export function SoryvoLogo({
  variant = "mark",
  size,
  className,
  priority = false,
  alt
}: SoryvoLogoProps) {
  if (variant === "full") {
    const width = size ?? 230;
    const height = Math.round(width * (621 / 651));

    return (
      <Image
        src="/brand/soryvo-logo-full.png"
        alt={alt ?? "Soryvo"}
        width={width}
        height={height}
        priority={priority}
        className={className}
        sizes="(max-width: 640px) 170px, 240px"
      />
    );
  }

  const markSize = size ?? 32;

  return (
    <Image
      src="/brand/soryvo-mark.png"
      alt={alt ?? ""}
      width={markSize}
      height={markSize}
      priority={priority}
      className={className}
      sizes={`${markSize}px`}
    />
  );
}
