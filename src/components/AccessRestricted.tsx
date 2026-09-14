export default function AccessRestricted({ moduleLabel }: { moduleLabel: string }) {
  return (
    <div className="panel">
      <div className="access-restricted">
        <div className="ar-icon">🔒</div>
        <div className="ar-title">You don&apos;t have access to {moduleLabel}</div>
        <div>Ask an administrator to grant your role access to this module.</div>
      </div>
    </div>
  );
}
