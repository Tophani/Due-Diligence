import { createContext, useContext } from 'react';

export const AssessmentContext = createContext(null);

/** The signed-in vendor's assessment (answers, saving, uploads). Must be inside <VendorApiProvider>. */
export function useAssessment() {
  const ctx = useContext(AssessmentContext);
  if (!ctx) throw new Error('useAssessment must be used inside <VendorApiProvider>');
  return ctx;
}
