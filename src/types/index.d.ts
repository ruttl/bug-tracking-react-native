declare module '@ruttl/bug-tracking' {
  import * as React from 'react';

  export interface BugTrackingProps {
    projectID: string;
    token: string;
    /** Optional callback invoked at capture time to resolve the current screen name. */
    getScreenName?: () => string | null | undefined;
  }

  export const BugTracking: React.FC<BugTrackingProps>;
}
