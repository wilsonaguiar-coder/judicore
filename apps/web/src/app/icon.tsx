import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Balança — desenhada em SVG inline */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          {/* Haste central */}
          <line x1="12" y1="3" x2="12" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Barra horizontal */}
          <line x1="3" y1="6" x2="21" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
          {/* Correntes */}
          <line x1="6" y1="6" x2="4" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="18" y1="6" x2="20" y2="11" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          {/* Pratos */}
          <path d="M2 11 Q6 14 10 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M14 11 Q18 14 22 11" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          {/* Base */}
          <line x1="9" y1="21" x2="15" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
