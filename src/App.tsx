import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AppTooltipProvider } from '@/shared/components/AppTooltip';

export default function App() {
  return (
    <AppTooltipProvider>
      <RouterProvider router={router} />
    </AppTooltipProvider>
  );
}
