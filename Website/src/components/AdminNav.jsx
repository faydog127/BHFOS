import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { 
  LayoutDashboard, Users, Calculator, FileText, 
  Settings, Calendar, MessageSquare, 
  BarChart, Home, Briefcase, Activity,
  ShieldAlert, LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import SystemModeToggle from './SystemModeToggle';
import TrainingModeToggle from './TrainingModeToggle';

const AdminNav = () => {
  const { user, signOut, isAdmin, role } = useSupabaseAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { to: "/crm/dashboard", icon: LayoutDashboard, label: "Overview" },
    { to: "/crm/solo", icon: Activity, label: "Solo Dashboard" },
    { to: "/crm/pipeline", icon: Activity, label: "Pipeline" },
    { to: "/crm/jobs", icon: Briefcase, label: "Jobs" },
    { to: "/crm/schedule", icon: Calendar, label: "Schedule" },
    { to: "/crm/inbox", icon: MessageSquare, label: "Inbox" },
    { to: "/crm/leads", icon: Users, label: "Leads" },
    { to: "/crm/customers", icon: Users, label: "Customers" },
    { to: "/crm/partners", icon: Home, label: "Partners" },
    { to: "/crm/estimates", icon: Calculator, label: "Estimates" },
    { to: "/crm/invoices", icon: FileText, label: "Invoices" },
    { to: "/crm/reporting", icon: BarChart, label: "Reports" },
    { to: "/crm/settings", icon: Settings, label: "Settings" },
  ];

  // Admin Only Links
  if (isAdmin) {
    navItems.push({ 
      to: "/crm/admin/users", 
      icon: ShieldAlert, 
      label: "User Management" 
    });
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-gray-200 bg-white min-h-screen fixed left-0 top-0 bottom-0 z-40">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <span className="text-xl font-bold text-blue-900">The Vent Guys</span>
      </div>

      <div className="px-4 py-4 space-y-4">
          <div className="space-y-2">
            <TrainingModeToggle />
            <SystemModeToggle />
          </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors",
              isActive || location.pathname.startsWith(item.to)
                ? "bg-blue-50 text-blue-700" 
                : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <item.icon className={cn("mr-3 h-5 w-5", location.pathname.startsWith(item.to) ? "text-blue-600" : "text-gray-400 group-hover:text-gray-500")} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-3">
          <div className="ml-1 overflow-hidden">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[140px]" title={user?.email}>
              {user?.email}
            </p>
            <p className="text-xs text-blue-600 font-semibold capitalize bg-blue-50 inline-block px-1.5 rounded mt-0.5">
              {role || 'Viewer'}
            </p>
          </div>
        </div>
        <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={handleLogout}
        >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default AdminNav;