
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * BrandImage Component
 * 
 * An optimized image component that handles loading states, errors, and animations.
 * Supports srcSet, sizes, loading strategy, and decoding.
 * 
 * @param {string} src - Image source URL
 * @param {string} srcSet - Responsive image source set
 * @param {string} sizes - Responsive image sizes definition
 * @param {string} alt - Alt text for accessibility
 * @param {boolean} animate - Whether to fade in the image on load (default: true)
 * @param {boolean} priority - If true, uses eager loading (default: false)
 * @param {string} fetchPriority - 'high', 'low', or 'auto'
 * @param {ReactNode} fallback - Custom fallback content to show on error
 * @param {string} className - Classes for the img element
 * @param {string} containerClassName - Classes for the wrapper div
 */
const BrandImage = ({
  src,
  srcSet,
  sizes,
  alt,
  className,
  containerClassName,
  animate = true,
  priority = false,
  fetchPriority,
  fallbackSrc,
  fallback,
  width,
  height,
  onClick,
  style,
  decoding = "async",
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Helper to add cache-control params to Supabase URLs if not present
  const optimizeUrl = (url) => {
    if (url && url.includes('supabase.co') && !url.includes('?')) {
        // Append cache-control param for CDN optimization (if supported by backend, otherwise browser cache)
        // Note: Supabase Storage handles caching via headers automatically, but appending version/timestamp can bust cache if needed.
        // For immutable assets, no query string is often better, but here we ensure consistent URL structure.
        return url;
    }
    return url;
  };

  // Reset state when src prop changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setCurrentSrc(optimizeUrl(src));
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setHasError(false);
      setIsLoading(true);
      setCurrentSrc(fallbackSrc);
      return;
    }

    setIsLoading(false);
    setHasError(true);
    console.warn(`Failed to load image: ${src}`);
  };

  // Determine which component to use (motion vs standard)
  const ImgComponent = animate ? motion.img : 'img';
  
  // Calculate specific props for LCP optimization
  const loadingStrategy = priority ? "eager" : "lazy";
  // fetchpriority is a non-standard attribute but widely supported in Chromium
  const priorityAttr = priority ? "high" : fetchPriority || "auto";

  return (
    <div 
      className={cn("relative overflow-hidden", containerClassName)}
      style={{ width: width ? `${width}px` : 'auto', height: height ? `${height}px` : 'auto', ...style }}
    >
      <AnimatePresence mode="wait">
        {isLoading && !priority && (
          <motion.div
            key="skeleton"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-10"
          >
             <Skeleton className={cn("w-full h-full bg-slate-200/50", className)} />
          </motion.div>
        )}
      </AnimatePresence>

      {hasError ? (
        <div className={cn(
          "flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 h-full w-full min-h-[100px]", 
          className
        )}>
          {fallback || (
            <>
              <ImageOff className="w-8 h-8 opacity-50 mb-2" />
              <span className="text-xs text-center font-medium opacity-60">Image Unavailable</span>
            </>
          )}
        </div>
      ) : (
        <ImgComponent
          src={currentSrc}
          srcSet={srcSet}
          sizes={sizes}
          alt={alt || "Brand asset"}
          loading={loadingStrategy}
          decoding={decoding}
          fetchpriority={priorityAttr}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "block max-w-full h-auto object-cover",
            // If priority is true, we skip the fade-in animation to render ASAP for LCP
            !priority && animate && "transition-opacity duration-500",
            !priority && animate && (isLoading ? "opacity-0" : "opacity-100"),
            className
          )}
          initial={!priority && animate ? { opacity: 0, scale: 0.98 } : undefined}
          animate={!priority && animate ? { opacity: isLoading ? 0 : 1, scale: isLoading ? 0.98 : 1 } : undefined}
          transition={{ duration: 0.4, ease: "easeOut" }}
          onClick={onClick}
          width={width}
          height={height}
          {...props}
        />
      )}
    </div>
  );
};

export default BrandImage;
