interface LoaderProps {
  size?: number;
  text?: string;
}

/**
 * Page loader shown by `app/protected/loading.tsx` while a portal route
 * streams in. It renders inline rather than as a `fixed` overlay because the
 * portal's glass panel uses `backdrop-filter`, which turns it into the
 * containing block for fixed descendants and would squash the overlay to the
 * panel's height. Keyframes live in `app/globals.css` (`cfa-loader-*`) so this
 * stays a Server Component.
 */
export function AiLoader({ size = 180, text = "Loading" }: LoaderProps) {
  const letters = text.split("");

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex min-h-[60vh] w-full items-center justify-center"
    >
      <span className="sr-only">Loading page</span>
      {/* `bg-[#ffffff]` rather than `bg-white`: the portal's light-theme frost
          rule in globals.css turns every `bg-white` inside `.portal-glass`
          translucent, and this box should stay solid white. */}
      <div className="flex items-center justify-center rounded-[2rem] border border-black/5 bg-[#ffffff] p-12 shadow-[0_28px_90px_rgba(20,10,46,0.25)] dark:border-white/10 dark:bg-black dark:shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
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
    </div>
  );
}
