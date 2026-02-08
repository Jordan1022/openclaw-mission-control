import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ActivityItem {
  id: string;
  timestamp: Date;
  type: 'memory' | 'cron' | 'system' | 'session';
  title: string;
  summary: string;
  source: string;
}

export interface CronJob {
  id: string;
  schedule: string;
  command: string;
  description?: string;
  enabled: boolean;
  nextRun?: Date;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  source: string;
  type: 'memory' | 'document' | 'cron';
  date?: Date;
}

const WORKSPACE_PATH = '/home/jordan/.openclaw/workspace';
const MEMORY_PATH = join(WORKSPACE_PATH, 'memory');

export async function getMemoryFiles(): Promise<string[]> {
  try {
    const files = await readdir(MEMORY_PATH);
    return files
      .filter(f => f.endsWith('.md') && f.match(/^\d{4}-\d{2}-\d{2}\.md$/))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export async function getMemoryContent(date: string): Promise<string> {
  try {
    const content = await readFile(join(MEMORY_PATH, `${date}.md`), 'utf-8');
    return content;
  } catch {
    return '';
  }
}

export async function getActivityFeed(limit: number = 50): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];
  
  // Read memory files
  const memoryFiles = await getMemoryFiles();
  for (const file of memoryFiles.slice(0, 7)) {
    const date = file.replace('.md', '');
    const content = await getMemoryContent(date);
    if (content) {
      const lines = content.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^#\s*/, '') || `Memory ${date}`;
      
      activities.push({
        id: `memory-${date}`,
        timestamp: new Date(date),
        type: 'memory',
        title,
        summary: lines.slice(1, 4).join(' ').substring(0, 150) + '...',
        source: `memory/${file}`,
      });
    }
  }

  // Read main MEMORY.md
  try {
    const mainMemory = await readFile(join(WORKSPACE_PATH, 'MEMORY.md'), 'utf-8');
    if (mainMemory) {
      const lines = mainMemory.split('\n').filter(l => l.trim());
      activities.push({
        id: 'memory-main',
        timestamp: new Date(),
        type: 'memory',
        title: 'Long-term Memory',
        summary: lines.slice(0, 3).join(' ').substring(0, 150) + '...',
        source: 'MEMORY.md',
      });
    }
  } catch {
    // Ignore
  }

  // Get recent cron activity from memory files
  for (const file of memoryFiles.slice(0, 3)) {
    const date = file.replace('.md', '');
    const content = await getMemoryContent(date);
    const cronMatches = content.match(/cron|schedule|job/gi);
    if (cronMatches) {
      activities.push({
        id: `cron-${date}`,
        timestamp: new Date(date),
        type: 'cron',
        title: 'Cron Activity',
        summary: `Found ${cronMatches.length} cron-related entries`,
        source: `memory/${file}`,
      });
    }
  }

  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, limit);
}

export async function getCronJobs(): Promise<CronJob[]> {
  try {
    const { stdout } = await execAsync('openclaw cron list 2>&1 || echo "[]"');
    // Parse the output - this is a mock implementation
    // In reality, we'd parse the actual openclaw cron list output
    const jobs: CronJob[] = [];
    
    // Try to parse JSON output if available
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Fall through to parsing text output
    }

    // Parse text output like:
    // ID    Schedule    Command    Enabled
    // job1  */5 * * * *  echo test  true
    const lines = stdout.split('\n').filter(l => l.trim());
    for (const line of lines.slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        jobs.push({
          id: parts[0],
          schedule: parts[1],
          command: parts.slice(2, -1).join(' ') || parts[2],
          enabled: parts[parts.length - 1] === 'true',
        });
      }
    }

    return jobs;
  } catch {
    // Return sample data if command fails
    return [
      { id: 'heartbeat', schedule: '*/30 * * * *', command: 'heartbeat check', enabled: true },
      { id: 'cleanup', schedule: '0 2 * * *', command: 'cleanup logs', enabled: true },
      { id: 'backup', schedule: '0 */6 * * *', command: 'backup workspace', enabled: false },
    ];
  }
}

export async function getSearchIndex(): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  
  // Index memory files
  const memoryFiles = await getMemoryFiles();
  for (const file of memoryFiles) {
    const date = file.replace('.md', '');
    const content = await getMemoryContent(date);
    if (content) {
      results.push({
        id: `memory-${date}`,
        title: `Memory: ${date}`,
        content,
        source: `memory/${file}`,
        type: 'memory',
        date: new Date(date),
      });
    }
  }

  // Index MEMORY.md
  try {
    const mainMemory = await readFile(join(WORKSPACE_PATH, 'MEMORY.md'), 'utf-8');
    results.push({
      id: 'memory-main',
      title: 'Long-term Memory',
      content: mainMemory,
      source: 'MEMORY.md',
      type: 'memory',
    });
  } catch {
    // Ignore
  }

  // Index other markdown files in workspace
  try {
    const files = await readdir(WORKSPACE_PATH);
    for (const file of files.filter(f => f.endsWith('.md'))) {
      if (file === 'MEMORY.md' || file.match(/^\d{4}-\d{2}-\d{2}\.md$/)) continue;
      
      const content = await readFile(join(WORKSPACE_PATH, file), 'utf-8');
      results.push({
        id: `doc-${file}`,
        title: file.replace('.md', ''),
        content,
        source: file,
        type: 'document',
      });
    }
  } catch {
    // Ignore
  }

  return results;
}

export function parseScheduleToDay(schedule: string): number {
  // Parse cron schedule to day of week (0-6)
  // Default to all days if complex
  const parts = schedule.split(' ');
  if (parts.length >= 5) {
    const dayOfWeek = parts[4];
    if (dayOfWeek !== '*' && dayOfWeek !== '?') {
      const day = parseInt(dayOfWeek, 10);
      if (!isNaN(day) && day >= 0 && day <= 6) {
        return day;
      }
    }
  }
  return -1; // All days
}

export function formatSchedule(schedule: string): string {
  const parts = schedule.split(' ');
  if (parts.length !== 5) return schedule;
  
  const [minute, hour, , , dayOfWeek] = parts;
  
  if (schedule === '*/30 * * * *') return 'Every 30 minutes';
  if (schedule === '0 2 * * *') return 'Daily at 2:00 AM';
  if (schedule === '0 */6 * * *') return 'Every 6 hours';
  if (schedule === '0 * * * *') return 'Hourly';
  
  return schedule;
}
