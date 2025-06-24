'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button' 
import { 
  Shield, 
  Menu, 
  X, 
  Bell, 
  User, 
  Settings, 
  LogOut,
  Crown,
  Check,
  MailWarning, // Icon for notifications
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'


// Interface for Notification
interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string; // ISO date string
  type: 'CONTENT_DETECTED' | 'TAKEDOWN_STATUS' | 'GENERAL_ALERT'; // Example types
}


export function Header() {
  const { data: session, status } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false)
  const [isPopoverOpen, setIsPopoverOpen] = useState(false)


  // Fetch initial unread count (e.g., from dashboard stats or a dedicated endpoint)
  // This is a simplified example; in a real app, this might come from a global state/context
  // or be fetched alongside other user-specific data.
  const fetchInitialUnreadCount = async () => {
    if (!session?.user?.id) return;
    try {
      // Assuming the dashboard stats endpoint returns unreadNotifications count
      const response = await fetch(`/api/dashboard/stats?userId=${session.user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.overview?.unreadNotifications || 0);
      }
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  useEffect(() => {
    fetchInitialUnreadCount();
  }, [session]);


  const fetchNotifications = async () => {
    if (!session?.user?.id) return;
    setIsLoadingNotifications(true);
    try {
      const response = await fetch('/api/notifications'); // Assumes API fetches for the logged-in user
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || data || []); // Adjust based on API response
        setUnreadCount(data.notifications?.filter((n: Notification) => !n.isRead).length || 0);
      } else {
        toast.error("Erro ao carregar notificações.");
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Erro de conexão ao buscar notificações.");
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const handleNotificationIconClick = () => {
    setIsPopoverOpen(!isPopoverOpen);
    if (!isPopoverOpen && notifications.length === 0) { // Fetch only if opening and no notifs loaded yet
        fetchNotifications();
    } else if(isPopoverOpen) {
      // Optionally refresh unread count when closing, or rely on other mechanisms
      fetchInitialUnreadCount();
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1)); // Decrement unread count
        toast.success("Notificação marcada como lida.");
      } else {
        toast.error("Erro ao marcar notificação como lida.");
      }
    } catch (error) {
      toast.error("Erro de conexão ao marcar como lida.");
    }
  };

  const handleMarkAllAsRead = async () => {
    // This assumes an endpoint like /api/notifications/read-all exists
    try {
      const response = await fetch('/api/notifications/read-all', { method: 'POST' });
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
        toast.success("Todas as notificações marcadas como lidas.");
      } else {
        toast.error("Erro ao marcar todas como lidas.");
      }
    } catch (error) {
      toast.error("Erro de conexão ao marcar todas como lidas.");
    }
  };


  const navigation = [
    { name: 'Dashboard', href: '/dashboard' },
    { name: 'Perfis de Marca', href: '/brand-profiles' },
    { name: 'Monitoramento', href: '/monitoring' },
    { name: 'Takedowns', href: '/takedown-requests' }, // Corrigido para /takedown-requests
    { name: 'Planos', href: '/pricing' }
  ]

  const getPlanBadgeColor = (planType: string) => {
    switch (planType) {
      case 'FREE': return 'bg-gray-500'
      case 'BASIC': return 'bg-blue-500'
      case 'PREMIUM': return 'bg-purple-500'
      case 'ENTERPRISE': return 'bg-gold-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-primary">DMCA Guard</span>
          </Link>

          {/* Desktop Navigation */}
          {session && (
            <nav className="hidden md:flex items-center space-x-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          )}

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {status === "authenticated" && session?.user ? (
              <>
                {/* Plan Badge */}
                <Badge 
                  className={`${getPlanBadgeColor(session.user.planType)} text-white`}
                >
                  <Crown className="h-3 w-3 mr-1" />
                  {session.user.planType}
                </Badge>

                {/* Notifications */}
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative" onClick={handleNotificationIconClick}>
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                          {unreadCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0">
                    <div className="flex justify-between items-center p-4 border-b">
                      <h3 className="text-lg font-semibold">Notificações</h3>
                      {notifications.length > 0 && unreadCount > 0 && (
                         <Button variant="link" size="sm" onClick={handleMarkAllAsRead} className="text-xs">
                           Marcar todas como lidas
                         </Button>
                       )}
                    </div>
                    {isLoadingNotifications ? (
                      <div className="p-4 text-center">Carregando...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground">Nenhuma notificação nova.</div>
                    ) : (
                      <ScrollArea className="h-[300px]">
                        {notifications.map((notification) => (
                          <div key={notification.id} className={`p-3 border-b ${!notification.isRead ? 'bg-accent' : ''}`}>
                            <div className="flex items-start space-x-3">
                              <MailWarning className={`h-5 w-5 mt-1 ${!notification.isRead ? 'text-primary' : 'text-muted-foreground'}`} />
                              <div>
                                <p className={`text-sm font-medium ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                                  {notification.title}
                                </p>
                                <p className={`text-xs ${!notification.isRead ? 'text-foreground/80' : 'text-muted-foreground/80'}`}>
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                                </p>
                              </div>
                            </div>
                            {!notification.isRead && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2 text-xs"
                                onClick={() => handleMarkAsRead(notification.id)}
                              >
                                <Check className="h-3 w-3 mr-1" /> Marcar como lida
                              </Button>
                            )}
                          </div>
                        ))}
                      </ScrollArea>
                    )}
                     {notifications.length > 0 && (
                       <div className="p-2 border-t text-center">
                         <Link href="/notifications" onClick={() => setIsPopoverOpen(false)}>
                           <Button variant="link" className="text-xs">Ver todas</Button>
                         </Link>
                       </div>
                     )}
                  </PopoverContent>
                </Popover>

                {/* User Menu */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <User className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56">
                    <div className="py-1">
                      <div className="px-4 py-2 text-sm text-muted-foreground border-b">
                        <p className="font-semibold">{session.user.name}</p>
                        <p className="truncate">{session.user.email}</p>
                      </div>
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm hover:bg-accent rounded-md"
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configurações
                      </Link>
                      <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="flex items-center w-full px-4 py-2 text-sm hover:bg-accent text-left rounded-md"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </>
            ) : status === "loading" ? (
              // Optional: Show a loading state for the user menu area
              <div className="flex items-center space-x-2">
                <div className="h-8 w-20 bg-muted rounded animate-pulse"></div> {/* Placeholder for buttons */}
              </div>
            ) : ( // Unauthenticated or error status
              <div className="flex items-center space-x-2">
                <Link href="/auth/login">
                  <Button variant="ghost">Entrar</Button>
                </Link>
                <Link href="/auth/register">
                  <Button>Cadastrar</Button>
                </Link>
              </div>
            )}

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && session && (
          <div className="md:hidden border-t py-4">
            <nav className="flex flex-col space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="px-2 py-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}