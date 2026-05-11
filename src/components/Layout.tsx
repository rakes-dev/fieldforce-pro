import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Map as MapIcon, 
  ShoppingBag, 
  LayoutDashboard, 
  LogOut, 
  UserCircle,
  ClipboardCheck,
  PlusSquare,
  History,
  Navigation
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function Layout({ portal }: { portal: 'admin' | 'employee' }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const adminNav = [
    { label: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { label: 'Tracking', path: '/admin/tracking', icon: Navigation },
    { label: 'Employees', path: '/admin/employees', icon: Users },
    { label: 'Shops', path: '/admin/shops', icon: MapIcon },
    { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
  ];

  const employeeNav = [
    { label: 'Dashboard', path: '/employee', icon: LayoutDashboard },
    { label: 'Orders', path: '/employee/orders', icon: ShoppingBag },
    { label: 'Visits', path: '/employee/visits', icon: History },
    { label: 'New Shop', path: '/employee/new-shop', icon: PlusSquare },
  ];

  const navItems = portal === 'admin' ? adminNav : employeeNav;

  return (
    <div className="flex h-screen bg-[#F1F5F9] overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0F172A] text-slate-400">
        <div className="p-8">
          <h1 className="text-xl font-bold flex items-center gap-3 text-white tracking-tight">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
               <div className="w-4 h-4 bg-white rounded-sm"></div>
            </div>
            ForceTrack Pro
          </h1>
          <p className="text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-widest">{portal} Control</p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  isActive 
                    ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/10" 
                    : "hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-6 mt-auto">
          <Link 
            to={`/${portal}/profile`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-all group",
              location.pathname === `/${portal}/profile` 
                ? "bg-slate-800 border-white/20 ring-1 ring-white/10 shadow-lg" 
                : "bg-slate-800/50 border-white/5 hover:bg-slate-800"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white font-bold italic group-hover:scale-105 transition-transform">
               {user?.displayName?.[0] || 'A'}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-semibold text-white truncate">{user?.displayName || 'Admin User'}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 mt-4 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 px-8 items-center justify-between">
           <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                {navItems.find(i => i.path === location.pathname)?.label || 'System'}
              </h2>
              {portal === 'admin' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded uppercase tracking-wide">
                  Live Tracking Active
                </span>
              )}
           </div>
           <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                 <p className="text-[10px] text-slate-400 font-bold uppercase">Force Status</p>
                 <p className="text-sm font-bold text-slate-900">Verified Connection</p>
              </div>
           </div>
        </header>

        {/* Mobile Header */}
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h1 className="font-bold tracking-tight">ForceTrack</h1>
          <Link 
            to={`/${portal}/profile`}
            className={cn(
              "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold transition-colors",
              location.pathname === `/${portal}/profile` 
                ? "bg-accent border-accent text-white shadow-sm" 
                : "bg-slate-100 border-slate-200 hover:bg-slate-200"
            )}
          >
            {user?.displayName?.[0]}
          </Link>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <Outlet />
        </div>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden h-16 bg-white border-t grid grid-cols-4 items-center">
           {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-all",
                  isActive ? "text-accent" : "text-zinc-400"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
