export function Logo() {
  return (
    <div className="logo">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" fill="var(--blue-500)" />
        <path
          d="M10 9.5h8.5L22 13v9.5a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M12.5 16h7M12.5 19.5h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="logo-text">Notes</span>
    </div>
  );
}
