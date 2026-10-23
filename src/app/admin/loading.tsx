export default function AdminLoading() {
  return (
    <div className="admin-page" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="admin-skeleton h-3 w-24" />
        <div className="admin-skeleton h-8 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="admin-skeleton h-24" />
        ))}
      </div>
      <div className="admin-skeleton h-72" />
    </div>
  );
}
