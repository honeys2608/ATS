import React, { useEffect, useRef } from 'react';
import useActivityLogger from '../../hooks/useActivityLogger';

/**
 * ActivityTracker component automatically logs 'view' activity when a requirement
 * is displayed for more than 3 seconds. This helps maintain engagement tracking
 * for passive requirement detection.
 */
const ActivityTracker = ({ 
  requirementId, 
  activityType = 'view',
  description = '',
  minViewDuration = 3000, // 3 seconds minimum view time
  children 
}) => {
  const { logActivity } = useActivityLogger();
  const timeoutRef = useRef(null);
  const viewStartTime = useRef(null);\n\n  useEffect(() => {\n    if (!requirementId) return;\n\n    // Record when viewing started\n    viewStartTime.current = Date.now();\n\n    // Set timer to log activity after minimum duration\n    timeoutRef.current = setTimeout(() => {\n      const viewDuration = Date.now() - viewStartTime.current;\n      \n      logActivity(\n        requirementId, \n        activityType, \n        description || `Viewed requirement for ${Math.round(viewDuration / 1000)} seconds`,\n        { view_duration_ms: viewDuration }\n      );\n    }, minViewDuration);\n\n    // Cleanup function\n    return () => {\n      if (timeoutRef.current) {\n        clearTimeout(timeoutRef.current);\n      }\n    };\n  }, [requirementId, activityType, description, minViewDuration, logActivity]);\n\n  return <>{children}</>;\n};\n\n/**\n * Hook version for more flexible use in existing components\n */\nexport const useViewTracker = (requirementId, options = {}) => {\n  const { logActivity } = useActivityLogger();\n  const timeoutRef = useRef(null);\n  const viewStartTime = useRef(null);\n  \n  const {\n    activityType = 'view',\n    description = '',\n    minViewDuration = 3000\n  } = options;\n\n  const startTracking = () => {\n    if (!requirementId) return;\n\n    viewStartTime.current = Date.now();\n\n    timeoutRef.current = setTimeout(() => {\n      const viewDuration = Date.now() - viewStartTime.current;\n      \n      logActivity(\n        requirementId, \n        activityType, \n        description || `Viewed requirement for ${Math.round(viewDuration / 1000)} seconds`,\n        { view_duration_ms: viewDuration }\n      );\n    }, minViewDuration);\n  };\n\n  const stopTracking = () => {\n    if (timeoutRef.current) {\n      clearTimeout(timeoutRef.current);\n      timeoutRef.current = null;\n    }\n  };\n\n  useEffect(() => {\n    return () => stopTracking();\n  }, []);\n\n  return { startTracking, stopTracking };\n};\n\nexport default ActivityTracker;