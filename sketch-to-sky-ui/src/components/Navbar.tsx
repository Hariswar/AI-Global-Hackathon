const GITHUB_URL = 'https://github.com/'

export const Navbar = () => {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-white/30 bg-gradient-to-r from-sky-400 via-sky-500 to-sky-600/90 text-white backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-2xl shadow-lg shadow-sky-900/20">
            ✈️
          </span>
          <div className="leading-tight">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/80">
              AI-Assisted Studio
            </p>
            <h1 className="text-lg font-semibold sm:text-xl md:text-2xl">
              From Sketch to Sky
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>Project GitHub</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M10 0a10 10 0 0 0-3.16 19.5c.5.1.68-.22.68-.48v-1.68c-2.78.6-3.37-1.34-3.37-1.34-.46-1.18-1.12-1.5-1.12-1.5-.92-.64.07-.63.07-.63 1.02.07 1.55 1.05 1.55 1.05.9 1.54 2.37 1.1 2.95.84.09-.66.35-1.1.63-1.35-2.22-.25-4.55-1.11-4.55-4.93 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.9-1.29 2.74-1.02 2.74-1.02.56 1.38.21 2.4.11 2.65.65.7 1.03 1.59 1.03 2.68 0 3.83-2.34 4.68-4.57 4.92.36.3.68.9.68 1.82v2.7c0 .27.18.59.69.49A10 10 0 0 0 10 0Z" />
            </svg>
          </a>
          <a
            href="#members"
            className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <span>Members</span>
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}

