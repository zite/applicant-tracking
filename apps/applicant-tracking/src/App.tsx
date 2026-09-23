import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@project/components/ui/sonner';
import { AppShell } from './components/AppShell';
import { SeedGate } from './components/SeedGate';
import { useBootstrap } from './lib/queries';
import { useFavicon } from './lib/useFavicon';
import { ShellSkeleton } from './components/ShellSkeleton';
import { InboxPage } from './pages/InboxPage';
import { PipelinePage } from './pages/PipelinePage';
import { CandidatesPage } from './pages/CandidatesPage';
import { CandidateDetailPage } from './pages/CandidateDetailPage';
import { InterviewsPage } from './pages/InterviewsPage';
import { JobsPage } from './pages/JobsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

// HashRouter, not BrowserRouter: the app is served under a workspace path that
// the dev server and the runtime do not rewrite, so path-based deep links 404.

function Shell() {
  const { data, isPending, isError } = useBootstrap();

  if (isPending) return <ShellSkeleton />;
  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="mb-1.5 text-[15px] font-medium">Could not reach the workspace</h1>
          <p className="text-[13px] text-muted-foreground">
            Check that you are signed in to this organization, then reload.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SeedGate seeded={data.seeded}>
      <Routes>
        <Route element={<AppShell data={data} />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/pipeline/:jobId" element={<PipelinePage />} />
          <Route path="/candidates" element={<CandidatesPage />} />
          <Route path="/candidate/:applicationId" element={<CandidateDetailPage />} />
          <Route path="/interviews" element={<InterviewsPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/inbox" replace />} />
        </Route>
      </Routes>
    </SeedGate>
  );
}

export default function App() {
  useFavicon('Applicant Tracking');
  return (
    <HashRouter>
      <Shell />
      <Toaster position="bottom-right" />
    </HashRouter>
  );
}
