import { createContext, useContext } from 'react';

// Actions that belong to the shell rather than any one page: the shell owns the
// dialog, pages and the command palette just ask for it. Avoids every page
// mounting its own copy of the same modal.
export type AppActions = {
  openAddCandidate: (jobId?: string) => void;
};

const Ctx = createContext<AppActions>({ openAddCandidate: () => {} });

export const AppActionsProvider = Ctx.Provider;
export const useAppActions = () => useContext(Ctx);
