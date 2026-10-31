import type { AnchorHTMLAttributes } from 'react';
import { navigate } from '../../lib/router';

/** In-app link: a real <a href> (works with middle-click / open in new tab) that navigates without reloading. */
export function Link({ href, onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
