declare module '@ruttl/bug-tracking' {
  import * as React from 'react';

  export interface BugTrackingProps {
    projectID: string;
    token: string;
  }

  export const BugTracking: React.FC<BugTrackingProps>;
}
