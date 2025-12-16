
import React from 'react';
import { Helmet } from 'react-helmet';
import { NavLink, Outlet } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";

const settingsNav = [
  { name: 'Business Info', path: '/crm/settings' },
  { name: 'Branding', path: '/crm/settings/branding' },
  { name: 'System Diagnostics', path: '/crm/settings/diagnostics' },
];

const Settings = () => {
  return (
    <>
      <Helmet>
        <title>Settings | The Vent Guys CRM</title>
      </Helmet>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-[#091e39]">Settings</h1>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {settingsNav.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.path}
                      end
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                          isActive
                            ? 'bg-gray-200 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`
                      }
                    >
                      {item.name}
                    </NavLink>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </aside>
          <main className="lg:col-span-3">
             <Outlet />
          </main>
        </div>
      </div>
    </>
  );
};

export default Settings;
