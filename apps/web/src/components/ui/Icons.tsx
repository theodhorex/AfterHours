import React from "react";

export type IconName =
  | "bread"
  | "coin"
  | "zzz"
  | "alert"
  | "scroll"
  | "anvil"
  | "scale"
  | "caravan"
  | "quill"
  | "hourglass"
  | "play"
  | "pause"
  | "seal";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  size?: 16 | 24 | number;
  className?: string;
  "aria-label"?: string;
}

function renderPath(name: IconName): React.ReactNode {
  switch (name) {
    case "bread":
      return (
        <>
          <path d="M4 14c0-4.5 3.5-8 8-8s8 3.5 8 8c0 2-1.5 3-4 3H8c-2.5 0-4-1-4-3z" />
          <path d="M9 10l2 3" />
          <path d="M13 9l2 3" />
        </>
      );
    case "coin":
      return (
        <>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v10M9 9.5c0-1 1.2-1.5 3-1.5s3 .5 3 1.5-1.5 1.5-3 2-3 1-3 2 1.2 1.5 3 1.5 3-.5 3-1.5" />
        </>
      );
    case "zzz":
      return (
        <>
          <path d="M3 6h4l-4 5h4" />
          <path d="M10 11h4l-4 5h4" />
          <path d="M16 4h4l-4 5h4" />
        </>
      );
    case "alert":
      return (
        <>
          <path d="M12 3l9 16H3L12 3z" />
          <path d="M12 9v5" />
          <circle cx="12" cy="16.5" r="0.75" fill="currentColor" />
        </>
      );
    case "scroll":
      return (
        <>
          <path d="M19 17V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2z" />
          <path d="M4 19a2 2 0 0 1 2-2h13" />
          <path d="M8 8h8M8 12h5" />
        </>
      );
    case "anvil":
      return (
        <>
          <path d="M4 8h16l-2 3h-3v3l2 5H7l2-5v-3H6L4 8z" />
          <path d="M10 14h4" />
        </>
      );
    case "scale":
      return (
        <>
          <path d="M12 3v17M8 20h8" />
          <path d="M4 7h16" />
          <path d="M6 7l-3 6h6L6 7z" />
          <path d="M18 7l-3 6h6l-3-6z" />
        </>
      );
    case "caravan":
      return (
        <>
          <path d="M4 13c0-4.5 3-7 8-7s8 2.5 8 7H4z" />
          <path d="M2 13h2" />
          <circle cx="8" cy="16.5" r="2.5" />
          <circle cx="16" cy="16.5" r="2.5" />
          <path d="M10.5 16.5h3" />
        </>
      );
    case "quill":
      return (
        <>
          <path d="M20 4c-5 1-9 5-11 9l-3 7 7-3c4-2 8-6 9-11 0-1-1-2-2-2z" />
          <path d="M9 13l4 4" />
        </>
      );
    case "hourglass":
      return (
        <>
          <path d="M6 3h12M6 21h12" />
          <path d="M7 3v3l4 5-4 5v4" />
          <path d="M17 3v3l-4 5 4 5v4" />
          <path d="M12 12v1" />
        </>
      );
    case "play":
      return <polygon points="8,5 19,12 8,19" fill="currentColor" stroke="none" />;
    case "pause":
      return (
        <>
          <rect x="7" y="5" width="3.5" height="14" fill="currentColor" stroke="none" />
          <rect x="13.5" y="5" width="3.5" height="14" fill="currentColor" stroke="none" />
        </>
      );
    case "seal":
      return (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="5.5" strokeDasharray="2 2" />
          <path d="M10 12l1.5 1.5L14 10" />
        </>
      );
  }
}

export function Icon({
  name,
  size = 16,
  className = "",
  "aria-label": ariaLabel,
  ...rest
}: IconProps) {
  const isLabeled = Boolean(ariaLabel);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={isLabeled ? "false" : "true"}
      aria-label={ariaLabel}
      role={isLabeled ? "img" : "presentation"}
      className={`shrink-0 inline-block align-middle ${className}`}
      {...rest}
    >
      {renderPath(name)}
    </svg>
  );
}

export default Icon;
