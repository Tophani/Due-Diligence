/** Join truthy class names. */
export default function clsx(...parts) {
  return parts.filter(Boolean).join(' ');
}
