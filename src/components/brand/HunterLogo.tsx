import React from 'react';
import canonicalLogo from '../../assets/brand/hunter-autoworks-logo.jpg';

interface HunterLogoProps {
  variant?: 'full' | 'compact' | 'mark';
  className?: string;
}

/**
 * Hunter Autoworks canonical logo.
 *
 * BRAND RULE: this component renders the OFFICIAL supplied logo asset.
 * It must never be replaced by text or an icon approximation. The logo image
 * itself contains the full wordmark ("Hunter Autoworks — The Car Lab").
 *
 * The supplied asset is a square JPEG with a dark navy field and circular
 * artwork; it is displayed in a circular crop at natural aspect ratio.
 */
export const HunterLogo: React.FC<HunterLogoProps> = ({ variant = 'full', className = '' }) => {
  // Size map per variant — proportions of the circular artwork are preserved.
  const sizeClass =
    variant === 'mark' ? 'w-9 h-9' : variant === 'compact' ? 'w-8 h-8' : 'w-10 h-10';

  return (
    <img
      src={canonicalLogo}
      alt="Hunter Autoworks — The Car Lab"
      width={variant === 'mark' ? 36 : variant === 'compact' ? 32 : 40}
      height={variant === 'mark' ? 36 : variant === 'compact' ? 32 : 40}
      className={`${sizeClass} rounded-full object-cover select-none ${className}`}
      draggable={false}
      id="hunter-logo-img"
    />
  );
};
