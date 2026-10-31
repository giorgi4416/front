import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../../lib/utils';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** Optional keyboard hint shown in the tooltip, e.g. "Ctrl+B". */
  shortcut?: string;
  active?: boolean;
  tooltipSide?: 'top' | 'bottom';
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, shortcut, active, tooltipSide = 'bottom', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={active}
      data-tooltip={shortcut ? `${label} (${shortcut})` : label}
      data-tooltip-side={tooltipSide}
      className={cx('icon-btn', active && 'is-active', className)}
      {...rest}
    >
      {children}
    </button>
  );
});
