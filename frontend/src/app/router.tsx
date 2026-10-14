import { createBrowserRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ToolsPage } from '@/pages/ToolsPage';

export const router = createBrowserRouter([
  { path: '/', element: <ToolsPage /> },
  { path: '*', element: <NotFoundPage /> },
]);
