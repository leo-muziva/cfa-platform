interface LoaderProps {
  size?: number;
  text?: string;
}

/**
 * Full-screen page loader shown by `app/protected/loading.tsx` while a portal
 * route streams in. Keyframes live in `app/globals.css` (`cfa-loader-*`) so
 * this stays a Server Component.
 */
export function AiLoader({ size = 180, text = "Loading" }: LoaderProps) {
  const letters = text.split("");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#faf7ff]/80 backdrop-blur-md dark:bg-[#140a2e]/80"
    >
      <span className="sr-only">Loading page</span>
      <div
        aria-hidden="true"
        className="relative flex select-none items-center justify-center font-sans"
        style={{ width: size, height: size }}
      >
        {letters.map((letter, index) => (
          <span
            key={index}
            className="cfa-loader-letter inline-block text-[#140a2e] opacity-40 dark:text-white"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {letter === " " ? " " : letter}
          </span>
        ))}
        <div className="cfa-loader-ring absolute inset-0 rounded-full" />
      </div>
    </div>
  );
}
