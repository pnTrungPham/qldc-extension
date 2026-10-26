import { Moon, Sun } from 'lucide-react';

import { i18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/ui/theme-provider';

export default function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative" aria-label={i18n.__('Toggle theme', 'quan-li-dan-cu')}>
          <Sun className="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')}>{i18n.__('Light', 'quan-li-dan-cu')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>{i18n.__('Dark', 'quan-li-dan-cu')}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>{i18n.__('System', 'quan-li-dan-cu')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
