import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  variant?: 'rectangular' | 'circular' | 'rounded' | 'text' | 'button';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
  duration?: number;
  delay?: number;
}

// Enhanced CSS animations
const animations = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  @keyframes wave {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes pulse-opacity {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  @keyframes slide {
    0% { transform: translateX(-100%) skewX(-10deg); }
    100% { transform: translateX(200%) skewX(-10deg); }
  }
  
  .skeleton-shimmer {
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0.01) 20%,
      rgba(0, 0, 0, 0.03) 60%,
      rgba(0, 0, 0, 0)
    );
  }
`;

// Inject animations once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-animations')) {
  const style = document.createElement('style');
  style.id = 'skeleton-animations';
  style.textContent = animations;
  document.head.appendChild(style);
}

// Base skeleton component with enhanced animations
export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width = '100%',
  height = '20px',
  variant = 'rectangular',
  animation = 'pulse',
  duration = 1.5,
  delay = 0,
}) => {
  const style: React.CSSProperties = useMemo(() => ({
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    animationDelay: `${delay}s`,
  }), [width, height, delay]);

  const variantClasses = {
    rectangular: '',
    circular: 'rounded-full',
    rounded: 'rounded-lg',
    text: 'rounded-md',
    button: 'rounded-md',
  };

  const baseClasses = 'relative isolate overflow-hidden';

  const animationClasses = {
    pulse: 'animate-pulse bg-gradient-to-r from-gray-200/90 via-gray-200 to-gray-200/90 dark:from-gray-700/90 dark:via-gray-700 dark:to-gray-700/90',
    wave: 'bg-gray-200 dark:bg-gray-700',
    shimmer: 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%]',
    none: 'bg-gray-200 dark:bg-gray-700',
  };

  const animationStyles = {
    shimmer: { animation: `shimmer ${duration}s ease-in-out infinite` },
    wave: {},
    pulse: {},
    none: {},
  };

  return (
    <div
      className={cn(
        baseClasses,
        animationClasses[animation],
        variantClasses[variant],
        className
      )}
      style={{ ...style, ...animationStyles[animation] }}
      role="status"
      aria-label="Loading..."
    >
      {animation === 'wave' && (
        <div
          className="absolute inset-0 -translate-x-full skeleton-shimmer"
          style={{
            animation: `slide ${duration}s cubic-bezier(0.4, 0.0, 0.2, 1) infinite`,
            animationDelay: `${delay}s`,
          }}
        />
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Text skeleton with natural line variations
export const SkeletonText: React.FC<{ 
  lines?: number; 
  className?: string;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
  lineHeight?: number;
  randomWidths?: boolean;
}> = ({
  lines = 3,
  className = '',
  animation = 'pulse',
  lineHeight = 16,
  randomWidths = true,
}) => {
  const widths = useMemo(() => {
    if (!randomWidths) return Array(lines).fill('100%');
    return Array.from({ length: lines }, (_, i) => {
      if (i === lines - 1) return `${60 + Math.random() * 20}%`;
      return `${80 + Math.random() * 20}%`;
    });
  }, [lines, randomWidths]);
  
  return (
    <div className={cn('space-y-2.5', className)}>
      {widths.map((width, i) => (
        <Skeleton
          key={i}
          height={lineHeight}
          width={width}
          variant="text"
          animation={animation}
          delay={i * 0.05}
        />
      ))}
    </div>
  );
};

// Paragraph skeleton
export const SkeletonParagraph: React.FC<{
  sentences?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
  className?: string;
}> = ({ sentences = 4, animation = 'pulse', className = '' }) => {
  return (
    <div className={cn('space-y-4', className)}>
      <SkeletonText lines={3} animation={animation} />
      {sentences > 3 && (
        <SkeletonText lines={sentences - 3} animation={animation} />
      )}
    </div>
  );
};

// Avatar skeleton with presence indicator
export const SkeletonAvatar: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showPresence?: boolean;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ size = 'md', showPresence = false, animation = 'pulse' }) => {
  const sizes = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  return (
    <div className="relative inline-block">
      <Skeleton
        width={sizes[size]}
        height={sizes[size]}
        variant="circular"
        animation={animation}
      />
      {showPresence && (
        <Skeleton
          width={sizes[size] / 4}
          height={sizes[size] / 4}
          variant="circular"
          animation={animation}
          className="absolute bottom-0 right-0 ring-2 ring-white dark:ring-gray-800"
        />
      )}
    </div>
  );
};

// Enhanced card skeleton
export const SkeletonCard: React.FC<{ 
  className?: string;
  variant?: 'default' | 'media' | 'article' | 'product' | 'compact';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ 
  className = '',
  variant = 'default',
  animation = 'pulse',
}) => {
  const variants = {
    default: (
      <>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 space-y-2">
            <Skeleton height={24} width="60%" variant="rounded" animation={animation} />
            <Skeleton height={16} width="40%" variant="rounded" animation={animation} className="opacity-70" />
          </div>
          <SkeletonAvatar size="md" animation={animation} />
        </div>
        <SkeletonText lines={3} animation={animation} />
        <div className="flex items-center gap-3 mt-4">
          <Skeleton height={36} width={100} variant="button" animation={animation} />
          <Skeleton height={36} width={100} variant="button" animation={animation} />
        </div>
      </>
    ),
    media: (
      <>
        <Skeleton height={200} variant="rounded" animation={animation} className="mb-4" />
        <div className="space-y-3">
          <Skeleton height={24} width="70%" variant="rounded" animation={animation} />
          <SkeletonText lines={2} animation={animation} />
        </div>
      </>
    ),
    article: (
      <>
        <div className="flex items-center gap-3 mb-4">
          <SkeletonAvatar size="sm" animation={animation} />
          <div className="space-y-1">
            <Skeleton height={16} width={120} variant="text" animation={animation} />
            <Skeleton height={14} width={80} variant="text" animation={animation} className="opacity-60" />
          </div>
        </div>
        <Skeleton height={28} width="80%" variant="rounded" animation={animation} className="mb-3" />
        <SkeletonParagraph animation={animation} />
      </>
    ),
    product: (
      <>
        <Skeleton height={250} variant="rounded" animation={animation} className="mb-4" />
        <div className="space-y-3">
          <Skeleton height={20} width="70%" variant="rounded" animation={animation} />
          <div className="flex items-center gap-2">
            <Skeleton height={24} width={80} variant="rounded" animation={animation} />
            <Skeleton height={16} width={60} variant="rounded" animation={animation} className="opacity-60 line-through" />
          </div>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} width={16} height={16} variant="circular" animation={animation} />
            ))}
          </div>
        </div>
      </>
    ),
    compact: (
      <div className="flex items-center gap-4">
        <Skeleton width={60} height={60} variant="rounded" animation={animation} />
        <div className="flex-1 space-y-2">
          <Skeleton height={18} width="60%" variant="rounded" animation={animation} />
          <Skeleton height={14} width="40%" variant="rounded" animation={animation} className="opacity-60" />
        </div>
      </div>
    ),
  };

  return (
    <div className={cn(
      'bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 p-6',
      className
    )}>
      {variants[variant]}
    </div>
  );
};

// Message/Chat skeleton
export const SkeletonMessage: React.FC<{
  variant?: 'sent' | 'received';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ variant = 'received', animation = 'pulse' }) => {
  const isSent = variant === 'sent';
  
  return (
    <div className={cn('flex gap-3', isSent && 'justify-end')}>
      {!isSent && <SkeletonAvatar size="sm" animation={animation} />}
      <div className={cn('space-y-2', isSent && 'items-end')}>
        <Skeleton
          height={40}
          width={200}
          variant="rounded"
          animation={animation}
          className={cn(
            isSent ? 'bg-blue-100 dark:bg-blue-900/20' : 'bg-gray-100 dark:bg-gray-800'
          )}
        />
        <Skeleton
          height={12}
          width={60}
          variant="text"
          animation={animation}
          className="opacity-60"
        />
      </div>
    </div>
  );
};

// Timeline skeleton
export const SkeletonTimeline: React.FC<{
  items?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ items = 3, animation = 'pulse' }) => {
  return (
    <div className="space-y-6">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <Skeleton
              width={12}
              height={12}
              variant="circular"
              animation={animation}
              delay={i * 0.1}
            />
            {i < items - 1 && (
              <Skeleton
                width={2}
                height={60}
                animation={animation}
                delay={i * 0.1}
                className="mt-2"
              />
            )}
          </div>
          <div className="flex-1 pb-8">
            <Skeleton height={14} width={100} variant="text" animation={animation} delay={i * 0.1} className="mb-2 opacity-60" />
            <Skeleton height={20} width="70%" variant="rounded" animation={animation} delay={i * 0.1} className="mb-2" />
            <SkeletonText lines={2} animation={animation} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Gallery skeleton
export const SkeletonGallery: React.FC<{
  images?: number;
  columns?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ images = 6, columns = 3, animation = 'pulse' }) => {
  return (
    <div className={cn(
      'grid gap-4',
      `grid-cols-2 md:grid-cols-${columns}`
    )}>
      {[...Array(images)].map((_, i) => (
        <Skeleton
          key={i}
          height={200}
          variant="rounded"
          animation={animation}
          delay={i * 0.05}
          className="aspect-square"
        />
      ))}
    </div>
  );
};

// Media player skeleton
export const SkeletonMediaPlayer: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ animation = 'pulse' }) => {
  return (
    <div className="bg-black rounded-lg overflow-hidden">
      <Skeleton height={400} animation={animation} className="bg-gray-800" />
      <div className="p-4 space-y-4">
        <Skeleton height={4} variant="rounded" animation={animation} className="bg-gray-700" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton width={40} height={40} variant="circular" animation={animation} className="bg-gray-700" />
            <Skeleton width={32} height={32} variant="circular" animation={animation} className="bg-gray-700" />
            <Skeleton width={32} height={32} variant="circular" animation={animation} className="bg-gray-700" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton width={32} height={32} variant="circular" animation={animation} className="bg-gray-700" />
            <Skeleton width={32} height={32} variant="circular" animation={animation} className="bg-gray-700" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Comment skeleton
export const SkeletonComment: React.FC<{
  showReplies?: boolean;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ showReplies = false, animation = 'pulse' }) => {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <SkeletonAvatar size="sm" animation={animation} />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton height={16} width={120} variant="text" animation={animation} />
            <Skeleton height={12} width={60} variant="text" animation={animation} className="opacity-60" />
          </div>
          <SkeletonText lines={2} animation={animation} />
          <div className="flex items-center gap-4">
            <Skeleton height={16} width={40} variant="text" animation={animation} />
            <Skeleton height={16} width={40} variant="text" animation={animation} />
          </div>
        </div>
      </div>
      {showReplies && (
        <div className="ml-12 space-y-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <SkeletonAvatar size="xs" animation={animation} />
              <div className="flex-1 space-y-2">
                <Skeleton height={14} width={100} variant="text" animation={animation} />
                <SkeletonText lines={1} animation={animation} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Calendar skeleton
export const SkeletonCalendar: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ animation = 'pulse' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton height={24} width={150} variant="rounded" animation={animation} />
        <div className="flex gap-2">
          <Skeleton width={32} height={32} variant="circular" animation={animation} />
          <Skeleton width={32} height={32} variant="circular" animation={animation} />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-2 mb-4">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} height={20} variant="text" animation={animation} className="text-center" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => (
          <Skeleton
            key={i}
            height={36}
            variant="rounded"
            animation={animation}
            delay={i * 0.01}
            className={cn(i % 7 === 0 || i % 7 === 6 ? 'opacity-60' : '')}
          />
        ))}
      </div>
    </div>
  );
};

// Pricing card skeleton
export const SkeletonPricingCard: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ animation = 'pulse' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      <div className="text-center space-y-2">
        <Skeleton height={24} width="60%" variant="rounded" animation={animation} className="mx-auto" />
        <Skeleton height={16} width="80%" variant="text" animation={animation} className="mx-auto opacity-60" />
      </div>
      <div className="text-center space-y-1">
        <Skeleton height={48} width={120} variant="rounded" animation={animation} className="mx-auto" />
        <Skeleton height={16} width={80} variant="text" animation={animation} className="mx-auto opacity-60" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton width={20} height={20} variant="circular" animation={animation} />
            <Skeleton height={16} width="70%" variant="text" animation={animation} />
          </div>
        ))}
      </div>
      <Skeleton height={44} variant="button" animation={animation} />
    </div>
  );
};

// FAQ skeleton
export const SkeletonFAQ: React.FC<{
  items?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ items = 4, animation = 'pulse' }) => {
  return (
    <div className="space-y-4">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <Skeleton height={20} width="70%" variant="rounded" animation={animation} delay={i * 0.1} />
            <Skeleton width={20} height={20} variant="circular" animation={animation} delay={i * 0.1} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Code block skeleton
export const SkeletonCode: React.FC<{
  lines?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ lines = 8, animation = 'pulse' }) => {
  return (
    <div className="bg-gray-900 rounded-lg p-4 font-mono">
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton
              height={16}
              width={30}
              variant="text"
              animation={animation}
              delay={i * 0.05}
              className="opacity-40 bg-gray-700"
            />
            <Skeleton
              height={16}
              width={`${40 + Math.random() * 40}%`}
              variant="text"
              animation={animation}
              delay={i * 0.05}
              className="bg-gray-700"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// Data visualization skeleton
export const SkeletonChart: React.FC<{
  height?: number;
  type?: 'bar' | 'line' | 'pie' | 'donut' | 'area';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ 
  height = 300,
  type = 'bar',
  animation = 'pulse',
}) => {
  const chartVariants = {
    bar: (
      <div className="flex items-end justify-between gap-2 h-full px-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton
            key={i}
            width="100%"
            height={`${30 + Math.random() * 70}%`}
            variant="rounded"
            animation={animation}
            delay={i * 0.05}
            className="opacity-80"
          />
        ))}
      </div>
    ),
    line: (
      <div className="relative h-full">
        <svg className="absolute inset-0 w-full h-full">
          <Skeleton
            width="100%"
            height="100%"
            animation={animation}
            className="opacity-30"
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4 pb-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} height={12} width={30} variant="text" animation={animation} className="opacity-60" />
          ))}
        </div>
      </div>
    ),
    pie: (
      <div className="flex items-center justify-center h-full">
        <Skeleton
          width={height * 0.7}
          height={height * 0.7}
          variant="circular"
          animation={animation}
          className="opacity-60"
        />
      </div>
    ),
    donut: (
      <div className="flex items-center justify-center h-full relative">
        <Skeleton
          width={height * 0.7}
          height={height * 0.7}
          variant="circular"
          animation={animation}
          className="opacity-60"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton
            width={height * 0.35}
            height={height * 0.35}
            variant="circular"
            animation={animation}
            className="bg-white dark:bg-gray-800"
          />
        </div>
      </div>
    ),
    area: (
      <div className="relative h-full overflow-hidden">
        <Skeleton
          width="100%"
          height="100%"
          animation={animation}
          className="opacity-30"
        />
      </div>
    ),
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton height={24} width={200} variant="rounded" animation={animation} />
          <div className="flex gap-2">
            <Skeleton height={32} width={80} variant="button" animation={animation} />
            <Skeleton height={32} width={80} variant="button" animation={animation} />
          </div>
        </div>
        <div style={{ height }}>
          {chartVariants[type]}
        </div>
      </div>
    </div>
  );
};

// Kanban board skeleton
export const SkeletonKanban: React.FC<{
  columns?: number;
  cardsPerColumn?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ columns = 3, cardsPerColumn = 3, animation = 'pulse' }) => {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {[...Array(columns)].map((_, colIndex) => (
        <div key={colIndex} className="flex-shrink-0 w-80 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <Skeleton height={24} width="60%" variant="rounded" animation={animation} className="mb-4" />
          <div className="space-y-3">
            {[...Array(cardsPerColumn)].map((_, cardIndex) => (
              <div key={cardIndex} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <Skeleton height={16} width="80%" variant="text" animation={animation} className="mb-2" />
                <SkeletonText lines={2} animation={animation} lineHeight={14} />
                <div className="flex items-center gap-2 mt-3">
                  <SkeletonAvatar size="xs" animation={animation} />
                  <Skeleton height={12} width={60} variant="text" animation={animation} className="opacity-60" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// Feed/Activity skeleton
export const SkeletonFeed: React.FC<{
  items?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ items = 3, animation = 'pulse' }) => {
  return (
    <div className="space-y-4">
      {[...Array(items)].map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start gap-4 mb-4">
            <SkeletonAvatar animation={animation} />
            <div className="flex-1 space-y-1">
              <Skeleton height={18} width="30%" variant="text" animation={animation} />
              <Skeleton height={14} width="20%" variant="text" animation={animation} className="opacity-60" />
            </div>
          </div>
          <SkeletonText lines={3} animation={animation} />
          <Skeleton height={200} variant="rounded" animation={animation} className="mt-4 mb-4" />
          <div className="flex items-center gap-6">
            <Skeleton height={20} width={60} variant="text" animation={animation} />
            <Skeleton height={20} width={60} variant="text" animation={animation} />
            <Skeleton height={20} width={60} variant="text" animation={animation} />
          </div>
        </div>
      ))}
    </div>
  );
};

// Composite loading states
export const SkeletonPage: React.FC<{
  variant?: 'dashboard' | 'list' | 'detail' | 'form';
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ variant = 'dashboard', animation = 'pulse' }) => {
  const variants = {
    dashboard: <SkeletonDashboardGrid animation={animation} />,
    list: (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton height={32} width={200} variant="rounded" animation={animation} />
          <Skeleton height={40} width={120} variant="button" animation={animation} />
        </div>
        <SkeletonTable rows={10} columns={5} animation={animation} />
      </div>
    ),
    detail: (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonCard variant="article" animation={animation} />
          <SkeletonCard variant="default" animation={animation} />
        </div>
        <div className="space-y-6">
          <SkeletonCard variant="compact" animation={animation} />
          <SkeletonCard variant="compact" animation={animation} />
        </div>
      </div>
    ),
    form: (
      <div className="max-w-2xl mx-auto">
        <Skeleton height={32} width="50%" variant="rounded" animation={animation} className="mb-6" />
        <SkeletonForm fields={6} animation={animation} />
      </div>
    ),
  };

  return variants[variant];
};

// Improved utility components
export const LoadingDots: React.FC<{ 
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  speed?: 'slow' | 'normal' | 'fast';
}> = ({ 
  size = 'md',
  color = 'bg-gray-400',
  speed = 'normal',
}) => {
  const sizeClasses = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const speeds = {
    slow: '0.8s',
    normal: '0.6s',
    fast: '0.4s',
  };

  return (
    <div className="inline-flex items-center gap-1" role="status" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            'rounded-full animate-bounce',
            sizeClasses[size],
            color
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: speeds[speed],
          }}
        />
      ))}
    </div>
  );
};

// Enhanced inline loader
export const InlineLoader: React.FC<{ 
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; 
  className?: string;
  color?: string;
  strokeWidth?: number;
}> = ({
  size = 'md',
  className = '',
  color = 'text-blue-600',
  strokeWidth = 4,
}) => {
  const sizeClasses = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8',
  };

  return (
    <div className={cn('inline-flex items-center justify-center', className)} role="status">
      <svg
        className={cn('animate-spin', sizeClasses[size], color)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

// Enhanced loading overlay
export const LoadingOverlay: React.FC<{ 
  message?: string;
  variant?: 'default' | 'minimal' | 'full';
  blur?: boolean;
}> = ({ 
  message = 'Loading...',
  variant = 'default',
  blur = true,
}) => {
  const variants = {
    default: (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl flex flex-col items-center space-y-4 max-w-sm">
        <InlineLoader size="lg" />
        <p className="text-gray-700 dark:text-gray-300 font-medium">{message}</p>
      </div>
    ),
    minimal: (
      <div className="flex items-center gap-3">
        <InlineLoader size="md" color="text-white" />
        <p className="text-white font-medium">{message}</p>
      </div>
    ),
    full: (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          <InlineLoader size="xl" />
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{message}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Please wait while we process your request</p>
          </div>
          <ProgressBar progress={30} showPercentage={false} />
        </div>
      </div>
    ),
  };

  return (
    <div className={cn(
      'fixed inset-0 flex items-center justify-center z-50',
      blur ? 'backdrop-blur-sm bg-black/30' : 'bg-black/50'
    )}>
      {variants[variant]}
    </div>
  );
};

// Enhanced progress bar
export const ProgressBar: React.FC<{
  progress: number;
  message?: string;
  className?: string;
  showPercentage?: boolean;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'striped' | 'gradient';
  animated?: boolean;
}> = ({ 
  progress, 
  message, 
  className = '',
  showPercentage = true,
  color = 'bg-blue-600',
  size = 'md',
  variant = 'default',
  animated = true,
}) => {
  const sizeClasses = {
    xs: 'h-1',
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const variantClasses = {
    default: color,
    striped: `${color} bg-stripes`,
    gradient: 'bg-gradient-to-r from-blue-500 to-purple-600',
  };

  return (
    <div className={cn('space-y-2', className)}>
      {message && <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>}
      <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'relative rounded-full transition-all',
            animated && 'duration-500 ease-out',
            sizeClasses[size],
            variantClasses[variant]
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          {variant === 'default' && animated && (
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          )}
        </div>
      </div>
      {showPercentage && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-right font-medium">
          {Math.round(progress)}%
        </p>
      )}
    </div>
  );
};

// Export commonly used compositions
export const SkeletonTable: React.FC<{ 
  rows?: number; 
  columns?: number;
  showHeader?: boolean;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  animation = 'pulse',
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {showHeader && (
        <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {[...Array(columns)].map((_, i) => (
              <Skeleton
                key={i}
                height={16}
                width={i === 0 ? '100%' : '80%'}
                variant="rounded"
                animation={animation}
                className="font-medium"
              />
            ))}
          </div>
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {[...Array(rows)].map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
          >
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {[...Array(columns)].map((_, colIndex) => (
                <Skeleton
                  key={colIndex}
                  height={16}
                  width={colIndex === 0 ? '90%' : `${Math.random() * 30 + 50}%`}
                  variant="rounded"
                  animation={animation}
                  delay={rowIndex * 0.05 + colIndex * 0.02}
                  className={colIndex === 0 ? '' : 'opacity-70'}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Transaction row skeleton
export const SkeletonTransactionRow: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
  showCategory?: boolean;
}> = ({ animation = 'pulse', showCategory = true }) => {
  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <Skeleton
          width={48}
          height={48}
          variant="circular"
          animation={animation}
        />
        <div className="flex-1 space-y-2">
          <Skeleton
            height={18}
            width="40%"
            variant="rounded"
            animation={animation}
          />
          <div className="flex items-center gap-3">
            <Skeleton
              height={14}
              width="25%"
              variant="rounded"
              animation={animation}
              className="opacity-60"
            />
            {showCategory && (
              <Skeleton
                height={20}
                width={60}
                variant="rounded"
                animation={animation}
                className="opacity-50"
              />
            )}
          </div>
        </div>
      </div>
      <div className="text-right space-y-2">
        <Skeleton
          height={20}
          width={100}
          variant="rounded"
          animation={animation}
        />
        <Skeleton
          height={14}
          width={60}
          variant="rounded"
          animation={animation}
          className="opacity-60 ml-auto"
        />
      </div>
    </div>
  );
};

// Dashboard grid skeleton
export const SkeletonDashboardGrid: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ animation = 'pulse' }) => {
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonStatsCard key={i} animation={animation} />
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonChart type="bar" animation={animation} />
        <SkeletonChart type="line" animation={animation} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <Skeleton
            height={24}
            width={200}
            variant="rounded"
            animation={animation}
          />
        </div>
        <div>
          {[...Array(5)].map((_, i) => (
            <SkeletonTransactionRow key={i} animation={animation} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Stats card skeleton
export const SkeletonStatsCard: React.FC<{
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
}> = ({ animation = 'pulse' }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <Skeleton
            height={14}
            width={100}
            variant="rounded"
            animation={animation}
            className="opacity-60"
          />
          <Skeleton
            height={32}
            width={120}
            variant="rounded"
            animation={animation}
          />
          <div className="flex items-center gap-2">
            <Skeleton
              height={16}
              width={16}
              variant="circular"
              animation={animation}
            />
            <Skeleton
              height={14}
              width={60}
              variant="rounded"
              animation={animation}
              className="opacity-60"
            />
          </div>
        </div>
        <Skeleton
          width={48}
          height={48}
          variant="circular"
          animation={animation}
          className="opacity-40"
        />
      </div>
    </div>
  );
};

// Form skeleton
export const SkeletonForm: React.FC<{ 
  fields?: number;
  animation?: 'pulse' | 'wave' | 'shimmer' | 'none';
  showLabels?: boolean;
}> = ({ 
  fields = 4,
  animation = 'pulse',
  showLabels = true,
}) => {
  return (
    <div className="space-y-6">
      {[...Array(fields)].map((_, i) => (
        <div key={i} className="space-y-2">
          {showLabels && (
            <Skeleton
              height={14}
              width={120}
              variant="rounded"
              animation={animation}
              delay={i * 0.1}
              className="opacity-70"
            />
          )}
          <Skeleton
            height={42}
            variant="rounded"
            animation={animation}
            delay={i * 0.1}
          />
        </div>
      ))}
      <div className="flex items-center justify-end gap-3 pt-4">
        <Skeleton
          height={40}
          width={100}
          variant="button"
          animation={animation}
        />
        <Skeleton
          height={40}
          width={120}
          variant="button"
          animation={animation}
        />
      </div>
    </div>
  );
};