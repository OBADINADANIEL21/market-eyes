/**
 * Friendly empty state used when a list has nothing to show.
 * Props: icon (emoji), title, message, actionLabel + onAction (optional button).
 */
export default function EmptyState({ icon = "🔍", title, message, actionLabel, onAction }) {
  return (
    <div className="card-enter text-center py-14 px-6 bg-white rounded-3xl border-2 border-dashed border-emerald-200 max-w-xl mx-auto">
      <div className="text-6xl mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-xl font-extrabold text-gray-900">{title}</h3>
      {message && <p className="text-gray-500 mt-2 max-w-sm mx-auto">{message}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-6 bg-brand text-white font-bold px-6 py-3 rounded-2xl shadow hover:bg-brand-dark hover:scale-105 transition-all duration-200"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
