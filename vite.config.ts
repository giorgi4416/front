import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Separate long-lived vendor chunks so app updates don't invalidate them.
        codeSplitting: {
          groups: [
            { name: 'editor', test: /node_modules[\\/](@tiptap|prosemirror|linkifyjs|orderedmap|rope-sequence|w3c-keyname)/ },
            { name: 'supabase', test: /node_modules[\\/]@supabase/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
});
