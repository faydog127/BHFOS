
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ImageOff, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * BrandImage Component
 * 
 * An optimized image component that handles loading states, errors, and animations.
 * 
 * @param {string} src - Image source URL
 * @param {string} alt - Alt text for accessibility
 * @param {boolean} animate - Whether to fade in the image on load (default: true)
 * @param {boolean} priority - If true, uses eager loading (default: false)
 * @param {ReactNode} fallback - Custom fallback content to show on error
 * @param {string} className - Classes for the img element
 * @param {string} containerClassName - Classes for the wrapper div
 */
const BrandImage = ({
  src,
  alt,
  className,
  containerClassName,
  animate = true,
  priority = false,
  fallback,
  width,
  height,
  onClick,
  style,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Reset state when src prop changes
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setCurrentSrc(src);
  }, [src]);

  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    console.warn(`Failed to load image: ${src}`);
  };

  // Determine which component to use (motion vs standard)
  const ImgComponent = animate ? motion.img : 'img';

  return (
    <div 
      className={cn("relative overflow-hidden", containerClassName)}
      style={{ width: width || 'auto', height: height || 'auto', ...style }}
    >
      <AnimatePresence mode="wait">
        {isLoading && (
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
          alt={alt || "Brand asset"}
          loading={priority ? "eager" : "lazy"}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "block max-w-full h-auto object-cover transition-opacity duration-500",
            isLoading ? "opacity-0" : "opacity-100",
            className
          )}
          initial={animate ? { opacity: 0, scale: 0.98 } : undefined}
          animate={animate ? { opacity: isLoading ? 0 : 1, scale: isLoading ? 0.98 : 1 } : undefined}
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
