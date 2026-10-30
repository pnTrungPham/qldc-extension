import { Settings } from 'lucide-react';
import { NavLink } from 'react-router';

import { i18n } from '@/lib/i18n';
import { caps } from '@/lib/caps';
import { useSettings } from '@/lib/api/settings.api';
import { Button } from '@/components/ui/button';
import { HeaderNavMenuItem, HeaderNavMenuList } from '@/components/ui/navmenu-header';

import { TABS } from '@/tabs';

import ThemeToggle from './ThemeToggle';

export default function Header() {
  const { data: settings } = useSettings();

  return (
    <header className="relative flex h-13.5 items-center gap-4 border-b bg-background pr-3 sm:gap-5 lg:pr-6">
      <div className="shrink-0 pl-5 text-base font-bold tracking-wide whitespace-nowrap uppercase lg:pl-6">
        {i18n.__('Population', 'quan-li-dan-cu')}
        {` · ${settings.ward_code}`}
        {settings.ward_name && ` · ${settings.ward_name}`}
      </div>

      <HeaderNavMenuList>
        {TABS.filter((tab) => tab.visible?.() ?? true).map(({ path, label, icon: Icon }) => (
          <HeaderNavMenuItem
            key={path}
            asChild
            className="text-muted-foreground-600 hover:text-primary aria-[current=page]:text-primary"
          >
            <NavLink to={path} end={path === '/'}>
              <Icon className="size-4 stroke-2" />
              <span className="max-md:hidden">{label}</span>
            </NavLink>
          </HeaderNavMenuItem>
        ))}
      </HeaderNavMenuList>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {caps.manage && (
          <Button asChild variant="outline" size="icon" aria-label={i18n.__('Settings', 'quan-li-dan-cu')}>
            <NavLink to="/settings">
              <Settings />
            </NavLink>
          </Button>
        )}
      </div>
    </header>
  );
}
