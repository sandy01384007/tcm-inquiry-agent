export function AiDoctorAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      aria-hidden
      className="shrink-0 rounded-full bg-[#f4e6c8] ring-2 ring-primary/30"
    >
      <circle cx="40" cy="40" r="40" fill="#f4e6c8" />
      <ellipse cx="40" cy="70" rx="22" ry="14" fill="#e8d9b0" />
      <circle cx="40" cy="36" r="18" fill="#f3d2b3" />
      <path d="M24 34c2-12 28-12 32 0 1 8-6 16-16 16s-17-8-16-16z" fill="#2c2a28" />
      <rect x="22" y="30" width="36" height="6" rx="3" fill="#fbf7ef" />
      <circle cx="32" cy="38" r="2.2" fill="#1c241f" />
      <circle cx="48" cy="38" r="2.2" fill="#1c241f" />
      <path d="M36 46c2 2 6 2 8 0" stroke="#9c332b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <rect x="28" y="54" width="24" height="22" rx="4" fill="#9c332b" />
      <rect x="36" y="58" width="8" height="10" rx="1" fill="#fbf7ef" />
      <circle cx="40" cy="63" r="1.6" fill="#9c332b" />
    </svg>
  );
}
