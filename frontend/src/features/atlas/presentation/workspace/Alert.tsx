/** A failure that is not beside a control, announced when it appears. */
export function Alert({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
