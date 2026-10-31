import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { flushPendingSaves } from '../lib/pendingSaves';
import { navigate } from '../lib/router';
import { errorMessage } from '../lib/utils';

/** Saves open drafts, then signs out. If a draft can't be saved, asks before discarding it. */
export function useSignOut() {
  const { signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [unsavedWarning, setUnsavedWarning] = useState(false);

  const finish = useCallback(async () => {
    setBusy(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
      toast.success('You’ve been signed out.');
    } catch (error) {
      toast.error(errorMessage(error, 'Could not sign out.'));
      setBusy(false);
    }
  }, [signOut, toast]);

  const request = useCallback(async () => {
    setBusy(true);
    if (await flushPendingSaves()) return finish();
    setBusy(false);
    setUnsavedWarning(true);
  }, [finish]);

  return {
    busy,
    request,
    unsavedWarning,
    confirmDiscard: finish,
    cancelDiscard: () => setUnsavedWarning(false),
  };
}
