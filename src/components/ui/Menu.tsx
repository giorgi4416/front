import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { cx } from '../../lib/utils';

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
  shortcut?: string;
}

interface MenuProps {
  /** Renders the trigger; spread the given props onto a <button>. */
  trigger: (props: {
    ref: Ref<HTMLButtonElement>;
    onClick: () => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => ReactNode;
  items: (MenuItem | 'separator')[];
  align?: 'start' | 'end';
  label: string;
  /** Optional non-interactive content above the items. */
  header?: ReactNode;
}

/** Accessible dropdown menu: arrow keys move, Enter selects, Escape closes and returns focus. */
export function Menu({ trigger, items, align = 'start', label, header }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const focusItem = (direction: 1 | -1 | 'first' | 'last') => {
    const nodes = [...(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])];
    if (!nodes.length) return;
    const current = nodes.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (direction === 'last') next = nodes.length - 1;
    else if (direction !== 'first') next = (current + direction + nodes.length) % nodes.length;
    nodes[next].focus();
  };

  useEffect(() => {
    if (!open) return;
    focusItem('first');
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  return (
    <div className="menu-root" ref={rootRef}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      })}
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cx('menu', align === 'end' && 'menu-end')}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') focusItem(1);
            else if (event.key === 'ArrowUp') focusItem(-1);
            else if (event.key === 'Home') focusItem('first');
            else if (event.key === 'End') focusItem('last');
            else if (event.key === 'Escape') close();
            else if (event.key === 'Tab') close(false);
            else return;
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {header && <div className="menu-header">{header}</div>}
          {items.map((item, index) =>
            item === 'separator' ? (
              <div key={`sep-${index}`} className="menu-separator" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={cx('menu-item', item.active && 'is-active', item.danger && 'is-danger')}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon && <span className="menu-item-icon">{item.icon}</span>}
                <span className="menu-item-label">{item.label}</span>
                {item.shortcut && <kbd className="menu-item-kbd">{item.shortcut}</kbd>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
