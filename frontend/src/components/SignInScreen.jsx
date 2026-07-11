export default function SignInScreen({ onSignIn, error, ready }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center font-semibold text-white text-xl mx-auto mb-5">
          $
        </div>
        <h1 className="text-xl font-semibold text-text-primary mb-2">Money Tracking</h1>
        <p className="text-text-secondary text-sm mb-6">
          Sign in with the Google account that has access to your "Money Tracking - AUD" spreadsheet.
        </p>
        <button
          onClick={() => onSignIn()}
          disabled={!ready}
          className="w-full py-2.5 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#fff" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12s3.36-7.27 7.19-7.27c3.08 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.19 2C6.42 2 2.03 6.8 2.03 12s4.39 10 10.16 10c5.05 0 9.81-3.44 9.81-10.45 0-.79-.09-1.45-.65-1.45Z"/>
          </svg>
          Sign in with Google
        </button>
        {error && <p className="mt-4 text-sm text-expense">{error}</p>}
        {!ready && !error && <p className="mt-4 text-sm text-text-muted">Checking session…</p>}
      </div>
    </div>
  );
}
