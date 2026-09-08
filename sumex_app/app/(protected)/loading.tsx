export default function ProtectedLoading() {
  return (
    <div className="flex-col gap-6" style={{ width: '100%', animation: 'fadeIn 0.2s ease-in-out' }}>
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
        <div className="flex-col gap-2">
          <div className="skeleton" style={{ height: '32px', width: '240px', borderRadius: '8px' }} />
          <div className="skeleton" style={{ height: '16px', width: '380px', borderRadius: '6px' }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="skeleton" style={{ height: '36px', width: '110px', borderRadius: '8px' }} />
        </div>
      </div>

      {/* 4 Cards Grid skeleton */}
      <div className="grid-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card-glass flex-col gap-3"
            style={{
              padding: '20px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="skeleton" style={{ height: '16px', width: '90px', borderRadius: '4px' }} />
              <div className="skeleton" style={{ height: '22px', width: '48px', borderRadius: '12px' }} />
            </div>
            <div className="skeleton" style={{ height: '34px', width: '150px', borderRadius: '6px', margin: '4px 0' }} />
            <div className="skeleton" style={{ height: '14px', width: '110px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>

      {/* Main Section Skeletons */}
      <div className="grid-2 gap-6 mt-2">
        <div
          className="card-glass flex-col gap-4"
          style={{
            height: '340px',
            padding: '24px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="skeleton" style={{ height: '22px', width: '180px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '22px', width: '80px', borderRadius: '6px' }} />
          </div>
          <div className="skeleton" style={{ height: '100%', width: '100%', borderRadius: '8px' }} />
        </div>

        <div
          className="card-glass flex-col gap-4"
          style={{
            height: '340px',
            padding: '24px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="skeleton" style={{ height: '22px', width: '180px', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '22px', width: '80px', borderRadius: '6px' }} />
          </div>
          <div className="skeleton" style={{ height: '100%', width: '100%', borderRadius: '8px' }} />
        </div>
      </div>
    </div>
  )
}
