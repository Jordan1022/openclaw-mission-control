'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  Search, 
  Activity, 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  Terminal,
  ChevronRight,
  Radio,
  Database,
  Cpu,
  Loader2,
  Menu,
  User,
  LogOut,
  Home,
  X
} from 'lucide-react';
import Fuse from 'fuse.js';
import { format, parseISO } from 'date-fns';

interface ActivityItem {
  id: string;
  timestamp: string;
  type: 'memory' | 'cron' | 'system' | 'session';
  title: string;
  summary: string;
  source: string;
}

interface CronJob {
  id: string;
  schedule: string;
  command: string;
  description?: string;
  enabled: boolean;
}

interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  type: 'memory' | 'document' | 'cron';
  date?: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatSchedule(schedule: string): string {
  if (schedule === '*/30 * * * *') return 'Every 30 min';
  if (schedule === '0 2 * * *') return 'Daily 2AM';
  if (schedule === '0 */6 * * *') return 'Every 6h';
  if (schedule === '0 * * * *') return 'Hourly';
  if (schedule === '0 9 * * *') return 'Daily 9AM';
  return schedule;
}

function getActivityIcon(type: ActivityItem['type']) {
  switch (type) {
    case 'memory': return <Database className="h-4 w-4" />;
    case 'cron': return <Clock className="h-4 w-4" />;
    case 'system': return <Cpu className="h-4 w-4" />;
    case 'session': return <Terminal className="h-4 w-4" />;
    default: return <Activity className="h-4 w-4" />;
  }
}

function getActivityColor(type: ActivityItem['type']) {
  switch (type) {
    case 'memory': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'cron': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'system': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'session': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
}

function MobileNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();

  const navItems = [
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden text-slate-400 hover:text-slate-200">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="bg-slate-900 border-slate-800 w-[280px]">
        <SheetHeader>
          <SheetTitle className="text-slate-100 flex items-center gap-2">
            <Radio className="h-5 w-5 text-cyan-400" />
            Mission Control
          </SheetTitle>
        </SheetHeader>
        <div className="mt-8 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  activeTab === item.id
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
        <Separator className="my-6 bg-slate-800" />
        <div className="space-y-4">
          {session?.user && (
            <div className="flex items-center gap-3 px-4">
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-cyan-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{session.user.name}</p>
                <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            onClick={() => signOut()}
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BottomNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  const navItems = [
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'calendar', label: 'Schedule', icon: CalendarIcon },
    { id: 'search', label: 'Search', icon: Search },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 lg:hidden z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                isActive ? 'text-cyan-400' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-0 w-12 h-0.5 bg-cyan-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default function MissionControl() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState('activity');
  const [searchQuery, setSearchQuery] = useState('');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Load data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [activitiesRes, cronRes, searchRes] = await Promise.all([
          fetch('/data/activities.json'),
          fetch('/data/cron-jobs.json'),
          fetch('/data/search-index.json'),
        ]);
        
        setActivities(await activitiesRes.json());
        setCronJobs(await cronRes.json());
        setSearchResults(await searchRes.json());
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const fuse = useMemo(() => {
    return new Fuse(searchResults, {
      keys: ['title', 'content'],
      threshold: 0.3,
    });
  }, [searchResults]);

  const filteredResults = useMemo(() => {
    if (!searchQuery) return [];
    return fuse.search(searchQuery).map(r => r.item);
  }, [searchQuery, fuse]);

  // Group cron jobs by day
  const weeklySchedule = useMemo(() => {
    const schedule: CronJob[][] = [[], [], [], [], [], [], []];
    cronJobs.forEach(job => {
      if (job.enabled) {
        for (let i = 0; i < 7; i++) {
          schedule[i].push(job);
        }
      }
    });
    return schedule;
  }, [cronJobs]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
          <span className="text-slate-400 font-mono">INITIALIZING MISSION CONTROL...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20 lg:pb-0">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full" />
              <Radio className="relative h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-bold tracking-wider text-slate-100">
                OPENCLAW <span className="text-cyan-400 hidden sm:inline">MISSION CONTROL</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-mono hidden sm:block">SYSTEM STATUS: ONLINE</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Search Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden text-slate-400"
              onClick={() => setShowMobileSearch(!showMobileSearch)}
            >
              {showMobileSearch ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
            
            {/* Desktop User Menu */}
            <div className="hidden lg:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs sm:text-sm font-mono text-slate-400">
                  {format(new Date(), 'yyyy-MM-dd HH:mm:ss')} UTC
                </p>
                <p className="text-[10px] sm:text-xs text-slate-600">SESSION ACTIVE</p>
              </div>
              {session?.user && (
                <div className="flex items-center gap-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="h-8 w-8 rounded-full border border-slate-700"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-slate-700">
                      <User className="h-4 w-4 text-cyan-400" />
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-slate-200"
                    onClick={() => signOut()}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile User Avatar */}
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || 'User'}
                className="lg:hidden h-8 w-8 rounded-full border border-slate-700"
              />
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        {showMobileSearch && (
          <div className="sm:hidden px-3 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-slate-900/50 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
                autoFocus
              />
            </div>
            {searchQuery && (
              <div className="mt-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl max-h-64 overflow-auto">
                {filteredResults.length === 0 ? (
                  <div className="p-4 text-slate-500 text-center text-sm">No results found</div>
                ) : (
                  filteredResults.slice(0, 5).map((result) => (
                    <div
                      key={result.id}
                      className="p-3 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-3 w-3 text-cyan-400" />
                        <span className="font-medium text-slate-200 text-sm truncate">{result.title}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{result.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-3 sm:p-4 lg:p-6">
        {/* Desktop Search Bar */}
        <div className="hidden sm:block mb-4 lg:mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search across memory, documents, and system logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
          />
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl z-40 max-h-96 overflow-auto">
              {filteredResults.length === 0 ? (
                <div className="p-4 text-slate-500 text-center">No results found</div>
              ) : (
                filteredResults.map((result) => (
                  <div
                    key={result.id}
                    className="p-4 border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-cyan-400" />
                      <span className="font-medium text-slate-200">{result.title}</span>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-500">
                        {result.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2">{result.content}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 lg:space-y-6">
          {/* Desktop Tabs */}
          <TabsList className="hidden lg:flex bg-slate-900 border border-slate-800">
            <TabsTrigger value="activity" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Activity className="h-4 w-4 mr-2" />
              Activity Feed
            </TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <CalendarIcon className="h-4 w-4 mr-2" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="search" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400">
              <Search className="h-4 w-4 mr-2" />
              Global Search
            </TabsTrigger>
          </TabsList>

          {/* Activity Feed Tab */}
          <TabsContent value="activity" className="space-y-4 mt-0 lg:mt-2">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
              {/* Main Activity Stream */}
              <Card className="xl:col-span-2 bg-slate-900/50 border-slate-800">
                <CardHeader className="p-4 lg:p-6">
                  <CardTitle className="flex items-center gap-2 text-slate-100 text-base lg:text-lg">
                    <Activity className="h-5 w-5 text-cyan-400" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs lg:text-sm">
                    System events, memory updates, and session history
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                  <ScrollArea className="h-[400px] sm:h-[500px] pr-2 lg:pr-4">
                    <div className="space-y-3 lg:space-y-4">
                      {activities.length === 0 ? (
                        <div className="text-center py-12 text-slate-600">
                          <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>No activity recorded yet</p>
                        </div>
                      ) : (
                        activities.map((activity) => (
                          <div
                            key={activity.id}
                            className="group relative p-3 lg:p-4 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start gap-3 lg:gap-4">
                              <div className={`p-2 rounded-lg border shrink-0 ${getActivityColor(activity.type)}`}>
                                {getActivityIcon(activity.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <h4 className="font-medium text-slate-200 text-sm lg:text-base truncate">{activity.title}</h4>
                                  <span className="text-[10px] lg:text-xs text-slate-600 font-mono shrink-0">
                                    {format(parseISO(activity.timestamp), 'MMM dd, HH:mm')}
                                  </span>
                                </div>
                                <p className="text-xs lg:text-sm text-slate-500 line-clamp-2">{activity.summary}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-[10px] lg:text-xs border-slate-700 text-slate-600">
                                    {activity.source}
                                  </Badge>
                                  <Badge variant="outline" className={`text-[10px] lg:text-xs capitalize border-slate-700 ${
                                    activity.type === 'memory' ? 'text-blue-400' :
                                    activity.type === 'cron' ? 'text-amber-400' :
                                    activity.type === 'system' ? 'text-emerald-400' :
                                    'text-purple-400'
                                  }`}>
                                    {activity.type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Stats Sidebar */}
              <div className="space-y-3 lg:space-y-4">
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="p-4 lg:p-6 pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">Total Activities</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                    <div className="text-2xl lg:text-3xl font-bold text-slate-100">{activities.length}</div>
                    <p className="text-[10px] lg:text-xs text-slate-600 mt-1">Last 14 days</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="p-4 lg:p-6 pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">Active Cron Jobs</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                    <div className="text-2xl lg:text-3xl font-bold text-emerald-400">
                      {cronJobs.filter(j => j.enabled).length}
                    </div>
                    <p className="text-[10px] lg:text-xs text-slate-600 mt-1">
                      {cronJobs.filter(j => !j.enabled).length} disabled
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader className="p-4 lg:p-6 pb-2">
                    <CardTitle className="text-xs lg:text-sm font-medium text-slate-400">Searchable Documents</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                    <div className="text-2xl lg:text-3xl font-bold text-cyan-400">{searchResults.length}</div>
                    <p className="text-[10px] lg:text-xs text-slate-600 mt-1">Memory and documents</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Calendar Tab */}
          <TabsContent value="calendar" className="mt-0 lg:mt-2">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="p-4 lg:p-6">
                <CardTitle className="flex items-center gap-2 text-slate-100 text-base lg:text-lg">
                  <CalendarIcon className="h-5 w-5 text-cyan-400" />
                  Weekly Schedule
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs lg:text-sm">
                  Cron job execution schedule across the week
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                {/* Mobile Calendar - Horizontal Scroll */}
                <div className="lg:hidden overflow-x-auto -mx-4 px-4">
                  <div className="flex gap-3 min-w-max">
                    {DAYS.map((day, index) => (
                      <div key={day} className="w-32 sm:w-40 space-y-2">
                        <div className="text-center pb-2 border-b border-slate-800">
                          <span className={`text-sm font-medium ${
                            new Date().getDay() === index ? 'text-cyan-400' : 'text-slate-500'
                          }`}>
                            {day}
                          </span>
                          {new Date().getDay() === index && (
                            <div className="h-0.5 w-6 mx-auto mt-1 bg-cyan-400 rounded-full" />
                          )}
                        </div>
                        <div className="space-y-2 min-h-[150px]">
                          {weeklySchedule[index]?.slice(0, 4).map((job) => (
                            <div
                              key={job.id}
                              className={`p-2 rounded border text-xs ${
                                job.enabled 
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                  : 'bg-slate-800/50 border-slate-700 text-slate-600'
                              }`}
                            >
                              <div className="font-medium truncate">{job.id}</div>
                              <div className="text-[10px] opacity-75 mt-1">
                                {formatSchedule(job.schedule)}
                              </div>
                            </div>
                          ))}
                          {weeklySchedule[index]?.length === 0 && (
                            <div className="text-center text-slate-700 text-xs py-4">--</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desktop Calendar */}
                <div className="hidden lg:grid lg:grid-cols-7 gap-4">
                  {DAYS.map((day, index) => (
                    <div key={day} className="space-y-3">
                      <div className="text-center pb-2 border-b border-slate-800">
                        <span className={`text-sm font-medium ${
                          new Date().getDay() === index ? 'text-cyan-400' : 'text-slate-500'
                        }`}>
                          {day}
                        </span>
                        {new Date().getDay() === index && (
                          <div className="h-0.5 w-6 mx-auto mt-1 bg-cyan-400 rounded-full" />
                        )}
                      </div>
                      <div className="space-y-2 min-h-[200px]">
                        {weeklySchedule[index]?.map((job) => (
                          <div
                            key={job.id}
                            className={`p-2 rounded border text-xs ${
                              job.enabled 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-slate-800/50 border-slate-700 text-slate-600'
                            }`}
                          >
                            <div className="font-medium truncate">{job.id}</div>
                            <div className="text-[10px] opacity-75 mt-1">
                              {formatSchedule(job.schedule)}
                            </div>
                          </div>
                        ))}
                        {weeklySchedule[index]?.length === 0 && (
                          <div className="text-center text-slate-700 text-xs py-4">--</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Separator className="my-4 lg:my-6 bg-slate-800" />

                {/* Cron Job List */}
                <div className="space-y-2">
                  <h4 className="text-xs lg:text-sm font-medium text-slate-400 mb-3">All Cron Jobs</h4>
                  {cronJobs.length === 0 ? (
                    <div className="text-center py-8 text-slate-600">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No cron jobs configured</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px] sm:h-auto">
                      <div className="space-y-2">
                        {cronJobs.map((job) => (
                          <div
                            key={job.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-slate-950/50 border border-slate-800 gap-2 sm:gap-4"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${job.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-200 text-sm truncate">{job.id}</div>
                                <div className="text-xs text-slate-600 font-mono truncate">{job.command}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 sm:gap-4 ml-5 sm:ml-0">
                              <code className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">
                                {formatSchedule(job.schedule)}
                              </code>
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] lg:text-xs shrink-0 ${job.enabled 
                                  ? 'border-emerald-500/30 text-emerald-400' 
                                  : 'border-slate-700 text-slate-600'
                                }`}
                              >
                                {job.enabled ? 'Active' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Search Tab */}
          <TabsContent value="search" className="mt-0 lg:mt-2">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader className="p-4 lg:p-6">
                <CardTitle className="flex items-center gap-2 text-slate-100 text-base lg:text-lg">
                  <Search className="h-5 w-5 text-cyan-400" />
                  Global Search
                </CardTitle>
                <CardDescription className="text-slate-500 text-xs lg:text-sm">
                  Search across all memory files, documents, and system records
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 lg:p-6 pt-0 lg:pt-0">
                <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 mb-4 lg:mb-6">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                      placeholder="Enter search query..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <Button variant="outline" className="border-slate-700 text-slate-400 hover:text-slate-200 w-full sm:w-auto">
                    Advanced
                  </Button>
                </div>

                {searchQuery ? (
                  <div className="space-y-3">
                    <p className="text-xs lg:text-sm text-slate-500">
                      Found {filteredResults.length} results for &quot;{searchQuery}&quot;
                    </p>
                    <ScrollArea className="h-[400px] sm:h-[500px]">
                      <div className="space-y-2 lg:space-y-3">
                        {filteredResults.map((result) => (
                          <div
                            key={result.id}
                            className="p-3 lg:p-4 rounded-lg bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {result.type === 'memory' && <Database className="h-4 w-4 text-blue-400 shrink-0" />}
                                {result.type === 'document' && <FileText className="h-4 w-4 text-amber-400 shrink-0" />}
                                {result.type === 'cron' && <Clock className="h-4 w-4 text-emerald-400 shrink-0" />}
                                <span className="font-medium text-slate-200 text-sm lg:text-base truncate">{result.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {result.date && (
                                  <span className="text-[10px] lg:text-xs text-slate-600">
                                    {format(parseISO(result.date), 'MMM dd, yyyy')}
                                  </span>
                                )}
                                <Badge variant="outline" className="text-[10px] lg:text-xs border-slate-700 text-slate-500 hidden sm:inline-flex">
                                  {result.source}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs lg:text-sm text-slate-500 line-clamp-2 lg:line-clamp-3">{result.content}</p>
                            <div className="flex items-center gap-1 mt-2 lg:mt-3 text-xs text-cyan-400 hover:text-cyan-300 cursor-pointer">
                              <span>View details</span>
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Search className="h-12 w-12 text-slate-800 mx-auto mb-4" />
                    <p className="text-slate-500 text-sm lg:text-base">Enter a search query to find records</p>
                    <p className="text-xs lg:text-sm text-slate-600 mt-1">
                      Search across {searchResults.length} memory files and documents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
