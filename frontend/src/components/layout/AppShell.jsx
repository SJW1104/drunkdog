import './AppShell.css'

// eslint-disable-next-line react/prop-types
function AppShell({ children }) {
  return (
    <div className="app-shell">
      <main className="app-shell__content">{children}</main>
    </div>
  )
}

export default AppShell