import type { ComponentType } from 'react';
import { Download, Home, Settings, Upload, Users } from 'lucide-react';

import { caps } from '@/lib/caps';
import { i18n } from '@/lib/i18n';

import DashboardPage from './pages/dashboard/DashboardPage';
import ExportPage from './pages/export/ExportPage';
import ImportPage from './pages/import/ImportPage';
import ResidentsPage from './pages/residents/ResidentsPage';
import SettingsPage from './pages/settings/SettingsPage';

/** The header tabs, in order. Header renders the menu from this list and router.tsx the routes. */
export const TABS: Array<{
  path: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Receives the tab label as its PageLayout title. */
  page: ComponentType<{ title: string }>;
  /** Hide the tab from the menu when false. The page and the API check access again. */
  visible?: () => boolean;
}> = [
  { path: '/', label: i18n.__('Overview', 'quan-li-dan-cu'), icon: Home, page: DashboardPage },
  { path: '/residents', label: i18n.__('Residents', 'quan-li-dan-cu'), icon: Users, page: ResidentsPage },
  { path: '/import', label: i18n.__('Import', 'quan-li-dan-cu'), icon: Upload, page: ImportPage, visible: () => caps.manage },
  { path: '/export', label: i18n.__('Export', 'quan-li-dan-cu'), icon: Download, page: ExportPage, visible: () => caps.manage },
  { path: '/settings', label: i18n.__('Settings', 'quan-li-dan-cu'), icon: Settings, page: SettingsPage, visible: () => false },
];
