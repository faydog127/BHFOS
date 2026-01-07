
import React from 'react';
import { 
  Bell, Search, Menu, Settings, HelpCircle, 
  LogOut, User as UserIcon, ChevronDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSupabaseAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate } from 'react-router-dom';

const EnterpriseHeader = ({ toggleSidebar, sidebarOpen }) => {
  const { user, signOut } = useSupabaseAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
          <Menu className="h-5 w-5 text-slate-600" />
        </Button>
        
        {/* Global Search */}
        <div className="relative w-full max-w-md hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search leads, contacts, deals..." 
            className="pl-9 h-10 bg-slate-50 border-slate-200 focus-visible:ring-indigo-500 focus-visible:ring-1"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Quick Actions */}
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
        </Button>
        <Button variant="ghost" size="icon" className="text-slate-500 hover:text-indigo-600" onClick={() => navigate('/crm/settings')}>
          <Settings className="h-5 w-5" />
        </Button>

        <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-1 h-10 rounded-full hover:bg-slate-50">
              <Avatar className="h-8 w-8 border border-slate-200">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-indigo-100 text-indigo-700">
                  {user?.email?.charAt(0).toUpperCase() || <UserIcon className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col items-start text-sm">
                <span className="font-semibold text-slate-700 leading-none">{user?.user_metadata?.full_name || 'User'}</span>
                <span className="text-[10px] text-slate-500 leading-none mt-1">Admin</span>
              </div>
              <ChevronDown className="h-4 w-4 text-slate-400 hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/crm/settings')}>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuItem>Team Management</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default EnterpriseHeader;
