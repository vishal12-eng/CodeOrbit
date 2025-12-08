import { LogOut, Settings, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserMenu() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <Skeleton className="h-8 w-8 rounded-full" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <Button variant="default" size="sm" asChild data-testid="button-login">
        <a href="/api/login">Log In</a>
      </Button>
    );
  }

  const nameForInitials = user.firstName ?? user.email ?? 'User';
  const initials = nameForInitials.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            {user.profileImageUrl && (
              <AvatarImage src={user.profileImageUrl} alt={user.firstName ?? 'User'} />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-2">
          <p className="text-sm font-medium" data-testid="text-username">{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.email}</p>
          <p className="text-xs text-muted-foreground" data-testid="text-email">{user.email}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid="menu-item-profile">
          <User className="mr-2 h-4 w-4" />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-item-settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild data-testid="menu-item-logout">
          <a href="/api/logout">
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
