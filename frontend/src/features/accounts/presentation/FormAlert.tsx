export function FormAlert({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}