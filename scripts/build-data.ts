import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const WORKSPACE_PATH = '/home/jordan/.openclaw/workspace';
const MEMORY_PATH = join(WORKSPACE_PATH, 'memory');
const OUTPUT_PATH = './public/data';

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

async function getMemoryFiles(): Promise<string[]> {
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

async function getMemoryContent(date: string): Promise<string> {
  try {
    const content = await readFile(join(MEMORY_PATH, `${date}.md`), 'utf-8');
    return content;
  } catch {
    return '';
  }
}

async function buildActivityFeed(): Promise<ActivityItem[]> {
  const activities: ActivityItem[] = [];
  
  const memoryFiles = await getMemoryFiles();
  for (const file of memoryFiles.slice(0, 14)) {
    const date = file.replace('.md', '');
    const content = await getMemoryContent(date);
    if (content) {
      const lines = content.split('\n').filter(l => l.trim());
      const title = lines[0]?.replace(/^#\s*/, '') || `Memory ${date}`;
      
      activities.push({
        id: `memory-${date}`,
        timestamp: new Date(date).toISOString(),
        type: 'memory',
        title,
        summary: lines.slice(1, 5).join(' ').substring(0, 200) + '...',
        source: `memory/${file}`,
      });

      // Look for session entries in the content
      const sessionMatches = content.match(/\[.*?\].*?(?=\[|$)/gs);
      if (sessionMatches) {
        sessionMatches.slice(0, 3).forEach((match, idx) => {
          const cleanMatch = match.trim();
          if (cleanMatch.length > 20) {
            activities.push({
              id: `session-${date}-${idx}`,
              timestamp: new Date(date).toISOString(),
              type: 'session',
              title: 'Session Activity',
              summary: cleanMatch.substring(0, 150) + '...',
              source: `memory/${file}`,
            });
          }
        });
      }
    }
  }

  // Read main MEMORY.md
  try {
    const mainMemory = await readFile(join(WORKSPACE_PATH, 'MEMORY.md'), 'utf-8');
    if (mainMemory) {
      const lines = mainMemory.split('\n').filter(l => l.trim());
      activities.push({
        id: 'memory-main',
        timestamp: new Date().toISOString(),
        type: 'memory',
        title: 'Long-term Memory (MEMORY.md)',
        summary: lines.slice(0, 5).join(' ').substring(0, 200) + '...',
        source: 'MEMORY.md',
      });
    }
  } catch {
    // Ignore
  }

  // Read AGENTS.md
  try {
    const agentsMd = await readFile(join(WORKSPACE_PATH, 'AGENTS.md'), 'utf-8');
    if (agentsMd) {
      activities.push({
        id: 'agents-md',
        timestamp: new Date().toISOString(),
        type: 'system',
        title: 'Agent Configuration',
        summary: 'Agent workspace guidelines and conventions',
        source: 'AGENTS.md',
      });
    }
  } catch {
    // Ignore
  }

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 50);
}

async function buildCronJobs(): Promise<CronJob[]> {
  try {
    const { stdout } = await execAsync('openclaw cron list 2>&1');
    
    // Try to parse as JSON first
    try {
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to text parsing
    }

    const jobs: CronJob[] = [];
    const lines = stdout.split('\n').filter(l => l.trim() && !l.includes('ID') && !l.includes('---'));
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        jobs.push({
          id: parts[0],
          schedule: parts[1],
          command: parts.slice(2, -1).join(' ') || parts[2],
          enabled: !parts.includes('disabled'),
        });
      }
    }

    return jobs;
  } catch {
    // Return default sample data
    return [
      { id: 'heartbeat', schedule: '*/30 * * * *', command: 'openclaw heartbeat', enabled: true },
      { id: 'cleanup', schedule: '0 2 * * *', command: 'cleanup logs', enabled: true },
      { id: 'backup', schedule: '0 */6 * * *', command: 'backup workspace', enabled: false },
      { id: 'daily-report', schedule: '0 9 * * *', command: 'generate daily report', enabled: true },
    ];
  }
}

async function buildSearchIndex(): Promise<SearchResult[]> {
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
        date,
      });
    }
  }

  // Index main files
  const mainFiles = ['MEMORY.md', 'AGENTS.md', 'TOOLS.md', 'HEARTBEAT.md'];
  for (const file of mainFiles) {
    try {
      const content = await readFile(join(WORKSPACE_PATH, file), 'utf-8');
      results.push({
        id: `doc-${file}`,
        title: file.replace('.md', ''),
        content,
        source: file,
        type: 'document',
      });
    } catch {
      // File doesn't exist
    }
  }

  return results;
}

async function main() {
  console.log('Building Mission Control data...');
  
  // Create output directory
  await mkdir(OUTPUT_PATH, { recursive: true });
  
  // Build activity feed
  console.log('Building activity feed...');
  const activities = await buildActivityFeed();
  await writeFile(join(OUTPUT_PATH, 'activities.json'), JSON.stringify(activities, null, 2));
  
  // Build cron jobs
  console.log('Building cron jobs...');
  const cronJobs = await buildCronJobs();
  await writeFile(join(OUTPUT_PATH, 'cron-jobs.json'), JSON.stringify(cronJobs, null, 2));
  
  // Build search index
  console.log('Building search index...');
  const searchIndex = await buildSearchIndex();
  await writeFile(join(OUTPUT_PATH, 'search-index.json'), JSON.stringify(searchIndex, null, 2));
  
  console.log('Done!');
  console.log(`- ${activities.length} activities`);
  console.log(`- ${cronJobs.length} cron jobs`);
  console.log(`- ${searchIndex.length} searchable documents`);
}

main().catch(console.error);
