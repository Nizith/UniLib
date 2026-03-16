import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const navLinkClass = (active) =>
  [
    'rounded-xl px-3 py-2 text-sm font-medium transition-colors no-underline',
    active
      ? 'bg-[#163b63] !text-white hover:!text-white visited:!text-white'
      : 'text-[#5f6f81] hover:bg-[#eef2f6] hover:text-[#203245] visited:text-[#5f6f81]',
  ].join(' ');

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const canManageBooks = user?.role === 'staff' || user?.role === 'admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[#dfd9cf] bg-[#faf9f6]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2">
            {/* <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#173b63] text-sm font-semibold tracking-[0.2em] text-white">
              UL
            </span> */}
            <img
              src="/UniLibLogo.png"
              alt="UniLib"
              className="h-12 w-auto object-contain"
            />
            <div>
              <span className="title-serif text-2xl font-semibold tracking-tight text-[#203245]">
                UniLib
              </span>
              <p className="text-sm text-[#6b7280]">Library access, loans, and alerts in one place.</p>
            </div>
          </Link>
        </div>

        <nav className="flex flex-wrap items-center gap-2 lg:justify-end">
          <Link to="/" className={navLinkClass(location.pathname === '/')}>
            Home
          </Link>
          {user && (
            <Link to="/my-loans" className={navLinkClass(location.pathname === '/my-loans')}>
              My Loans
            </Link>
          )}
          {user && (
            <Link
              to="/notifications"
              className={navLinkClass(location.pathname === '/notifications')}
            >
              Notifications
            </Link>
          )}
          {user && (
            <Link to="/profile" className={navLinkClass(location.pathname === '/profile')}>
              Profile
            </Link>
          )}
          {canManageBooks && (
            <Link
              to="/manage-books"
              className={navLinkClass(location.pathname === '/manage-books')}
            >
              Manage Books
            </Link>
          )}
          {user ? (
            <div className="ml-0 flex items-center gap-3 rounded-xl border border-[#dfd9cf] bg-white px-3 py-2 lg:ml-2">
              <span className="text-sm text-[#203245]">Hi, {user.name}</span>
              <button
                type="button"
                onClick={handleLogout}
                className="button-secondary px-3 py-2 text-sm"
              >
                Logout
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className={navLinkClass(location.pathname === '/login')}>
                Login
              </Link>
              <Link
                to="/register"
                className="button-primary px-3 py-2 text-sm"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
