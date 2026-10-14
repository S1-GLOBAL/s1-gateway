import { RouterProvider } from 'react-router-dom';
import { OfflineBanner } from './pwa/OfflineBanner';
import { UpdatePrompt } from './pwa/UpdatePrompt';
import { AppProviders } from './providers';
import { router } from './router';

export function App() {
  return (
    <AppProviders>
      <OfflineBanner />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AppProviders>
  );
}
