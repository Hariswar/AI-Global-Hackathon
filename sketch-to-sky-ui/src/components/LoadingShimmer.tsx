import { cn } from '../utils/cn'

interface LoadingShimmerProps {
  className?: string
  label?: string
}

export const LoadingShimmer = ({ className, label }: LoadingShimmerProps) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/60',
        "before:absolute before:inset-0 before:w-[160%] before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-sky-500/30 before:to-transparent before:content-['']",
        'before:animate-[shimmer_1.8s_infinite]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {label && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-slate-300">
          {label}
        </span>
      )}
    </div>
  )
}

