import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@project/components/ui/sonner';
import { JobsListPage } from './pages/JobsListPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { useFavicon } from './lib/useFavicon';

// HashRouter for the same reason as the internal app: the site is served from a
// path the runtime does not rewrite, so path-based deep links would 404 on a
// hard refresh — and a careers link that breaks when someone reloads it is
// worse than one with a hash in it.
export default function App() {
  useFavicon('Careers at Northwind Labs');
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<JobsListPage />} />
        <Route path="/role/:slug" element={<JobDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="bottom-center" />
    </HashRouter>
  );
}
