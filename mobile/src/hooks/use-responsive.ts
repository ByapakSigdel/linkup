import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Layout breakpoints (in dp) for tablet-responsive UI.
 * - sm: phones
 * - md: small/portrait tablets (~600+)        → bigger type, 2-col grids
 * - lg/xl: landscape tablets (~900/1200+)      → persistent sidebar, more cols
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const bp: Breakpoint =
    width >= 1200 ? 'xl' : width >= 900 ? 'lg' : width >= 600 ? 'md' : 'sm';

  return {
    width,
    height,
    isLandscape,
    bp,
    /** Tablet-ish: roomy enough for larger type + multi-column grids. */
    isTablet: width >= 600,
    /** Wide enough to pin the sidebar open beside the content (vs slide-out). */
    isWide: width >= 900,
    /** Suggested columns for media/post grids at the current width. */
    gridColumns: width >= 1200 ? 5 : width >= 900 ? 4 : width >= 600 ? 3 : 3,
    /** Comfortable max width for single-column content on big screens. */
    contentMaxWidth: width >= 1200 ? 900 : width >= 900 ? 760 : undefined,
  };
}
