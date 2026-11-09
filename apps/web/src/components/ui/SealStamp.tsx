import React from "react";
import { seedStampRotation } from "../../lib/ui-math.ts";
import { Icon } from "./Icons.tsx";

export interface SealStampProps {
  result: "verified" | "mismatch";
  label?: string;
  id?: string;
  className?: string;
}

export function SealStamp({
  result,
  label,
  id,
  className = "",
}: SealStampProps) {
  const isVerified = result === "verified";
  const seedKey = id || label || result;
  const rotation = seedStampRotation(seedKey, 4);

  const statusText = isVerified ? "VERIFIED" : "MISMATCH";
  const borderColor = isVerified ? "border-ledger-verdigris" : "border-ledger-wax";
  const textColor = isVerified ? "text-ledger-verdigris" : "text-ledger-wax";
  const bgColor = isVerified ? "bg-ledger-verdigris/10" : "bg-ledger-wax/10";

  return (
    <div
      role="status"
      aria-label={`${label ? `${label}: ` : ""}${statusText}`}
      className={`inline-flex flex-col items-center gap-1 ${className}`}
    >
      <div
        className="transform-gpu inline-block transition-transform"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <div
          className={`ledger-stamp-land ${
            !isVerified ? "ledger-stamp-jitter" : ""
          } border-2 border-dashed ${borderColor} ${textColor} ${bgColor} px-3 py-1.5 flex items-center gap-2 select-none`}
        >
          <Icon
            name={isVerified ? "seal" : "alert"}
            size={18}
            className="shrink-0"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="font-silk text-xs tracking-wider font-bold uppercase">
              {statusText}
            </span>
            {label && (
              <span className="font-mono text-[10px] opacity-80 leading-none">
                {label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SealStamp;
