/**
 * Sets up CSP violation reporting via console.
 * Logs all Content Security Policy violations for debugging.
 */
export function setupCSPReporter(): void {
  document.addEventListener('securitypolicyviolation', (event) => {
    console.warn('[CSP Violation]', {
      directive: event.violatedDirective,
      blockedURI: event.blockedURI,
      originalPolicy: event.originalPolicy,
      sourceFile: event.sourceFile,
      lineNumber: event.lineNumber,
    });
  });
}
