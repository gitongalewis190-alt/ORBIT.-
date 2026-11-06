
<div className="pw-field">
  <input
    type={showPw ? 'text' : 'password'}
    autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
    placeholder="Password"
    minLength={8}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />

  <button
    type="button"
    className="pw-toggle"
    onClick={() => setShowPw((prev) => !prev)}
    aria-label={showPw ? 'Hide password' : 'Show password'}
    aria-pressed={showPw}
  >
    {showPw ? (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" />
        <path d="M9.9 5.2A10.8 10.8 0 0112 5c5 0 8.5 4.5 9 7-.2 1.1-1 2.3-2.2 3.4" />
        <path d="M6.2 6.2C4.2 7.5 2.6 9.5 2 12c.5 2.5 4 7 10 7 1.1 0 2.2-.2 3.2-.5" />
      </svg>
    ) : (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )}
  </button>
</div>
