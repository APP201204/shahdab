import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Utensils,
  Zap,
  ChefHat,
  Truck,
  Table,
  BookOpen,
  Grid3X3,
  Receipt,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const navGroups = [
  {
    label: 'OPERATIONS',
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/table-service', icon: Utensils, label: 'Table Service' },
      { path: '/quick-order', icon: Zap, label: 'Quick Order' },
      { path: '/kitchen', icon: ChefHat, label: 'Kitchen' },
      { path: '/delivery', icon: Truck, label: 'Delivery' },
    ],
  },
  {
    label: 'TABLES & GUESTS',
    items: [
      { path: '/tables', icon: Table, label: 'Tables' },
      { path: '/sections', icon: Grid3X3, label: 'Sections' },
    ],
  },
  {
    label: 'MENU',
    items: [{ path: '/menu', icon: BookOpen, label: 'Menu' }],
  },
  {
    label: 'FINANCE',
    items: [
      { path: '/billing-stations', icon: Receipt, label: 'Billing Stations' },
      { path: '/reports', icon: BarChart3, label: 'Reports' },
    ],
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-[#0f0f12] text-gray-300 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-brand-900 text-gold-500 flex items-center justify-center font-bold text-lg">
              SH
            </div>
            <div>
              <div className="text-white font-semibold">SHADAB</div>
              <div className="text-xs text-gray-500">The Taste of Hyderabad</div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Live
            </span>
            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded text-gray-400">SW</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 px-3">
                {group.label}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = location.pathname === item.path;
                  const Icon = item.icon;
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          active
                            ? 'bg-brand-900 text-white'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                      >
                        <Icon size={18} />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-left text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <h2 className="text-lg font-medium text-gray-900">
            Welcome back, {user?.displayName || 'Guest'}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 capitalize">{user?.role || 'Unknown'}</span>
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center text-sm font-semibold">
              {user?.displayName?.[0] || 'U'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
