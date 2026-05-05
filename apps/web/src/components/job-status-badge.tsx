export function JobStatusBadge({ variant }: { variant: "active" | "completed" | "failed" }) {
  const styles = {
    active:    "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    failed:    "bg-red-100 text-red-700",
  };
  const labels = { active: "ativo", completed: "concluído", failed: "falhou" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${styles[variant]}`}>
      {labels[variant]}
    </span>
  );
}
