import { Lock, LockOpen, Music, PanelLeft, RotateCcw, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { APP_NAME } from '@/lib/appName';
import { GLASS } from '@/lib/glass';
import { cn } from '@/lib/utils';
import NowPlaying from './NowPlaying';
import ProfileSwitcher from './ProfileSwitcher';
import { useLayoutStore } from '@/stores/useLayoutStore';
import { useUiStore } from '@/stores/useUiStore';
import type { PanelId } from '@/types';

export interface NavItem {
  id: PanelId;
  label: string;
  icon: LucideIcon;
}

const PRIMARY: NavItem[] = [{ id: 'music', label: 'Music', icon: Music }];

const SYSTEM: NavItem[] = [{ id: 'settings', label: 'Settings', icon: Settings }];

export const NAV_ITEMS: NavItem[] = [...PRIMARY, ...SYSTEM];

const TITLE_BAR = 36;

const CLEAR_INNER =
  '[&>[data-slot=sidebar-inner][data-sidebar=sidebar]]:border-0 [&>[data-slot=sidebar-inner][data-sidebar=sidebar]]:bg-transparent [&>[data-slot=sidebar-inner][data-sidebar=sidebar]]:shadow-none';

interface NavSidebarProps {
  expanded: boolean;
  onHoverChange: (hovering: boolean) => void;
}

export default function NavSidebar({ expanded, onHoverChange }: NavSidebarProps) {
  const mode = useLayoutStore(s => s.navSidebar.mode);
  const setNavSidebar = useLayoutStore(s => s.setNavSidebar);
  const activePanel = useLayoutStore(s => s.activePanel);
  const setActivePanel = useLayoutStore(s => s.setActivePanel);
  const restartBackdrop = useUiStore(s => s.restartBackdrop);

  const locked = mode === 'locked-retracted';

  function toggleExpand() {
    setNavSidebar({ mode: mode === 'expanded' ? 'retracted' : 'expanded' });
  }

  function toggleLock() {
    setNavSidebar({ mode: locked ? 'retracted' : 'locked-retracted' });
  }

  function renderGroup(label: string, items: NavItem[]) {
    return (
      <SidebarGroup key={label}>
        <SidebarGroupLabel>{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {items.map(item => (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  className="hover:bg-accent/60 focus-visible:bg-accent/60 data-[active=true]:bg-accent/70"
                  isActive={activePanel === item.id}
                  tooltip={item.label}
                  onClick={() => setActivePanel(item.id)}
                >
                  <item.icon size={15} strokeWidth={1.6} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <Sidebar
      variant="floating"
      collapsible="icon"
      className={CLEAR_INNER}
      style={{ top: TITLE_BAR, height: `calc(100svh - ${TITLE_BAR}px)` }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <div className={cn(GLASS, 'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl')}>
        {expanded && (
          <SidebarHeader>
            <div className="flex items-center gap-2 px-1 py-1">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight">{APP_NAME}</div>
                <div className="truncate text-[11px] text-muted-foreground">music player</div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={toggleExpand} aria-label="Collapse sidebar">
                <PanelLeft size={15} strokeWidth={1.6} />
              </Button>
            </div>
          </SidebarHeader>
        )}

        <SidebarContent>
          {renderGroup('Workspace', PRIMARY)}
          {renderGroup('System', SYSTEM)}
        </SidebarContent>

        <SidebarFooter>
          <NowPlaying collapsed={!expanded} />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                className="hover:bg-accent/60 focus-visible:bg-accent/60"
                tooltip="Restart background"
                onClick={restartBackdrop}
              >
                <RotateCcw size={15} strokeWidth={1.6} />
                <span>Restart background</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className={`flex items-center gap-1 ${expanded ? '' : 'justify-center'}`}>
            <ProfileSwitcher collapsed={!expanded} />
            {expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={toggleLock} aria-pressed={locked}>
                    {locked ? <Lock size={15} strokeWidth={1.6} /> : <LockOpen size={15} strokeWidth={1.6} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {locked ? 'Auto expand off' : 'Auto expand on'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
