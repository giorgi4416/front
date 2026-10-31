import { useState } from 'react';
import { cx } from '../../lib/utils';
import type { AppUser } from '../../types';

export function initials(user: Pick<AppUser, 'displayName' | 'email'>): string {
  const source = user.displayName.trim() || user.email.split('@')[0];
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ user, size = 32, className }: { user: AppUser; size?: number; className?: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = user.avatarUrl && user.avatarUrl !== failedUrl;
  return (
    <span className={cx('avatar', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }} aria-hidden>
      {showImage ? (
        <img src={user.avatarUrl!} alt="" onError={() => setFailedUrl(user.avatarUrl)} />
      ) : (
        initials(user)
      )}
    </span>
  );
}
