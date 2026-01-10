'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { UserProfile } from '@/types/database';
import {
  HomeIcon,
  DocumentTextIcon,
  CurrencyDollarIcon,
  CubeIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  CogIcon,
  UserGroupIcon,
  TruckIcon,
  BookOpenIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  ChevronDownIcon,
  Bars3Icon,
  XMarkIcon,
  ReceiptPercentIcon,
  GlobeAltIcon,
  CalendarDaysIcon,
  BuildingStorefrontIcon,
  UsersIcon,
  CalculatorIcon,
  CakeIcon,
} from '@heroicons/react/24/outline';

// Navigation grouped by category for a tour company
const navigationGroups = [
  {
    name: 'Overview',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    ]
  },
  {
    name: 'Cafe Operations',
    items: [
      { name: 'Cafe Dashboard', href: '/dashboard/cafe', icon: CakeIcon },
    ]
  },
  {
    name: 'Tour Operations',
    items: [
      { name: 'Tour Packages', href: '/dashboard/tours', icon: GlobeAltIcon },
      { name: 'Bookings', href: '/dashboard/bookings', icon: CalendarDaysIcon },
      { name: 'Hotels', href: '/dashboard/hotels', icon: BuildingStorefrontIcon },
      { name: 'Fleet', href: '/dashboard/fleet', icon: TruckIcon },
    ]
  },
  {
    name: 'Finance',
    items: [
      { name: 'Invoices', href: '/dashboard/invoices', icon: DocumentTextIcon },
      { name: 'Receipts', href: '/dashboard/receipts', icon: ReceiptPercentIcon },
      { name: 'Bills', href: '/dashboard/bills', icon: BanknotesIcon },
      { name: 'Expenses', href: '/dashboard/expenses', icon: CurrencyDollarIcon },
      { name: 'Bank & Cash', href: '/dashboard/bank', icon: BuildingLibraryIcon },
    ]
  },
  {
    name: 'HR & Payroll',
    items: [
      { name: 'Employees', href: '/dashboard/employees', icon: UsersIcon },
      { name: 'Payroll', href: '/dashboard/payroll', icon: CalculatorIcon },
    ]
  },
  {
    name: 'Assets & Inventory',
    items: [
      { name: 'Inventory', href: '/dashboard/inventory', icon: CubeIcon },
      { name: 'Fixed Assets', href: '/dashboard/assets', icon: BuildingOfficeIcon },
    ]
  },
  {
    name: 'Relationships',
    items: [
      { name: 'Customers', href: '/dashboard/customers', icon: UserGroupIcon },
      { name: 'Vendors', href: '/dashboard/vendors', icon: TruckIcon },
    ]
  },
  {
    name: 'Accounting',
    items: [
      { name: 'General Ledger', href: '/dashboard/general-ledger', icon: BookOpenIcon },
      { name: 'Reports', href: '/dashboard/reports', icon: ChartBarIcon },
      { name: 'Settings', href: '/dashboard/settings', icon: CogIcon },
    ]
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          router.push('/login');
          return;
        }
        
        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (profileError) {
            console.error('Profile error:', profileError);
            // If profile doesn't exist, redirect to login
            if (profileError.code === 'PGRST116') {
              setIsLoading(false);
              router.push('/login');
              return;
            }
          }
          
          setUser(profile);
          setIsLoading(false);
        } else {
          // No session, redirect to login
          setIsLoading(false);
          router.push('/login');
        }
      } catch (error) {
        console.error('Error in getUser:', error);
        setIsLoading(false);
        router.push('/login');
      }
    };

    getUser();
    fetchNotifications();
  }, [router]);

  const fetchNotifications = async () => {
    try {
      // Fetch recent notifications based on overdue invoices, bills, etc.
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select(`
          id, 
          invoice_number, 
          customer_id, 
          due_date,
          customers!inner(name)
        `)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5);

      const { data: overdueBills } = await supabase
        .from('bills')
        .select(`
          id, 
          bill_number, 
          vendor_id, 
          due_date,
          vendors!inner(name)
        `)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
        .limit(5);

      const notificationList: any[] = [];
      
      overdueInvoices?.forEach((invoice: any) => {
        notificationList.push({
          id: `invoice-${invoice.id}`,
          type: 'overdue_invoice',
          title: `Invoice ${invoice.invoice_number} is overdue`,
          message: `From ${invoice.customers?.name || 'Unknown Customer'}`,
          time: new Date(invoice.due_date).toLocaleDateString(),
          href: `/dashboard/invoices/${invoice.id}`
        });
      });

      overdueBills?.forEach((bill: any) => {
        notificationList.push({
          id: `bill-${bill.id}`,
          type: 'overdue_bill',
          title: `Bill ${bill.bill_number} is overdue`,
          message: `To ${bill.vendors?.name || 'Unknown Vendor'}`,
          time: new Date(bill.due_date).toLocaleDateString(),
          href: `/dashboard/bills`
        });
      });

      setNotifications(notificationList.slice(0, 10));
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-breco-navy mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if no user (should redirect to login)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/assets/logo.jpg"
              alt="Breco Safaris"
              width={36}
              height={36}
              className="rounded"
            />
            <span className="font-semibold text-breco-navy">Breco Safaris</span>
          </Link>
          <button
            className="lg:hidden p-1 rounded hover:bg-gray-100"
            onClick={() => setSidebarOpen(false)}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4 overflow-y-auto h-[calc(100%-4rem)] scrollbar-thin">
          {navigationGroups.map((group) => (
            <div key={group.name}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                {group.name}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/dashboard' && pathname.startsWith(item.href));
                  
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(true)}
            >
              <Bars3Icon className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">
              Breco Safaris - Operations
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Notifications */}
            <div className="relative">
              <button 
                className="p-2 rounded-lg hover:bg-gray-100 relative"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
              >
                <BellIcon className="w-5 h-5 text-gray-600" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-breco-navy rounded-full" />
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="dropdown animate-fade-in w-60 sm:w-80 -right-20 sm:right-0 max-w-[calc(100vw-1rem)]">
                    <div className="p-3 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900">Notifications</h3>
                        <span className="text-xs text-gray-500">{notifications.length} items</span>
                      </div>
                    </div>
                    <div className="py-1 max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          <BellIcon className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm">No new notifications</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <Link
                            key={notification.id}
                            href={notification.href}
                            className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            onClick={() => setNotificationsOpen(false)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-2 h-2 rounded-full mt-2 ${
                                notification.type === 'overdue_invoice' ? 'bg-red-500' : 'bg-yellow-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {notification.title}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {notification.message} • {notification.time}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <div className="p-3 border-t border-gray-200">
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            router.push('/dashboard/reports');
                          }}
                        className="text-sm text-breco-navy hover:text-breco-navy-dark hover:underline"
                        >
                          View all reports
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-breco-navy rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user.full_name || user.email || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{user.role || 'User'}</p>
                </div>
                <ChevronDownIcon className="w-4 h-4 text-gray-500" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="dropdown animate-fade-in">
                    <div className="p-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/dashboard/settings/profile"
                        className="dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Profile Settings
                      </Link>
                      <Link
                        href="/dashboard/settings"
                        className="dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Company Settings
                      </Link>
                    </div>
                    <div className="border-t border-gray-200 py-1">
                      <button
                        onClick={handleSignOut}
                        className="dropdown-item w-full text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

