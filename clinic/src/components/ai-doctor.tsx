export function AiDoctorAvatar({ size = 40, live = false }: { size?: number; live?: boolean }) {
  const cls = "shrink-0 rounded-full object-cover object-top ring-2 ring-primary/40";
  if (live) {
    return (
      <video
        src="/ai-doctor.mp4"
        poster="/ai-doctor.jpg"
        autoPlay
        loop
        muted
        playsInline
        aria-hidden
        width={size}
        height={size}
        className={cls}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <img
      src="/ai-doctor.jpg"
      alt=""
      width={size}
      height={size}
      className={cls}
      style={{ width: size, height: size }}
    />
  );
}
