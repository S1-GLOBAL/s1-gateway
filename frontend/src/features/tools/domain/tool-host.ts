/** The part of a tool's address a person recognises: `payroll.example.com`. */
export function toolHost(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url;
  }
}
