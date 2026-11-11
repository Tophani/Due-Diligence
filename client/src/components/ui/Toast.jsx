import { Check } from '../vendor/SimpleShell.jsx';

/** Bottom-right confirmation toast. Renders nothing when `message` is empty. */
export default function Toast({ message }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed right-6 bottom-6 max-w-[calc(100%-48px)] bg-ink text-white rounded-control px-4 py-3 flex gap-2.5 items-center shadow-lg">
      <Check size={18} />
      <span>{message}</span>
    </div>
  );
}
