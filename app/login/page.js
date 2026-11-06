<div className="pw-field">
  <input
    type={showPw ? 'text' : 'password'}
    autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
    placeholder="Password"
    minLength={8}
    value={password}
    onChange={e => setPassword(e.target.value)}
    required
  />
  <button
    type="button"
    className="pw-toggle"
    onClick={() => setShowPw(v => !v)}
    aria-label={showPw ? 'Hide password' : 'Show password'}
    aria-pressed={showPw}
  >
    {/* eye-open SVG when hidden, eye-off SVG when shown; see the eye icon paths in the earlier login edit */}
  </button>
</div>
