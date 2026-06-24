import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';

import { StatusDot } from '../components/StatusDot.js';
import { LogLine } from '../components/LogLine.js';
import { Footer } from '../components/Footer.js';
import {
  pingHealth,
  getHealth,
  getRecentLogs,
  getDashboardStats,
} from '../api/client.js';
import type { LogEntry, DashboardStats } from '../api/types.js';

interface ServiceStatus {
  name: string;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

interface DashboardProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------

export function Dashboard({ onBack }: DashboardProps) {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const isWide = cols >= 100;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [healthResult, healthData, logsData, statsData] =
        await Promise.allSettled([
          pingHealth(),
          getHealth(),
          getRecentLogs(15),
          getDashboardStats(),
        ]);

      const ping = healthResult.status === 'fulfilled' ? healthResult.value : { ok: false, latencyMs: 0 };
      const health = healthData.status === 'fulfilled' ? healthData.value : null;

      setServices([
        {
          name: 'API',
          ok: ping.ok,
          latencyMs: ping.latencyMs,
          detail: health?.status === 'ok' ? 'healthy' : undefined,
        },
        {
          name: 'Database',
          ok: health?.database === 'ok' || ping.ok,
          latencyMs: ping.latencyMs,
          detail: health?.database,
        },
        {
          name: 'Bot',
          ok: ping.ok,
          latencyMs: 0,
          detail: 'telegram / discord',
        },
      ]);

      if (logsData.status === 'fulfilled') setLogs(logsData.value);
      if (statsData.status === 'fulfilled') setStats(statsData.value);

      setLastRefresh(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 3s auto-refresh
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  useInput((input, key) => {
    if (input === 'q' || key.escape) onBack();
    if (input === 'r') {
      setLoading(true);
      refresh();
    }
  });

  // -------------------------------------------------------------------
  // Service cards
  // -------------------------------------------------------------------

  const ServiceCard = ({ svc }: { svc: ServiceStatus }) => (
    <Box
      borderStyle="round"
      borderColor={svc.ok ? 'green' : 'red'}
      paddingX={2}
      paddingY={0}
      flexDirection="column"
      minWidth={24}
      flexGrow={1}
    >
      <Box gap={1}>
        <StatusDot connected={svc.ok} />
        <Text color="white" bold>
          {svc.name}
        </Text>
      </Box>
      <Text color="gray" dimColor>
        {svc.ok ? `${svc.latencyMs}ms` : 'unreachable'}
        {svc.detail ? `  ${svc.detail}` : ''}
      </Text>
    </Box>
  );

  // -------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------

  if (loading && services.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        <Text color="cyan" bold>
          📊 Dashboard
        </Text>
        <Box gap={1}>
          <Text color="cyan"><Spinner type="dots" /></Text>
          <Text color="cyan">Loading dashboard…</Text>
        </Box>
      </Box>
    );
  }

  if (error && services.length === 0) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
        <Text color="cyan" bold>📊 Dashboard</Text>
        <Box borderStyle="round" borderColor="red" paddingX={2} paddingY={0}>
          <Text color="red">✗  {error}</Text>
        </Box>
        <Text color="gray">Press <Text color="cyan">r</Text> to retry or <Text color="cyan">q</Text> to go back</Text>
        <Footer hints={[{ key: 'r', label: 'retry' }, { key: 'q', label: 'back' }]} />
      </Box>
    );
  }

  // -------------------------------------------------------------------
  // Main layout
  // -------------------------------------------------------------------

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} gap={1}>
      {/* Header */}
      <Box gap={2} alignItems="center">
        <Text color="cyan" bold>
          📊 Live Dashboard
        </Text>
        {loading && <Text color="gray"><Spinner type="dots" /></Text>}
        {lastRefresh && (
          <Text color="gray" dimColor>
            refreshed {lastRefresh.toLocaleTimeString('en-US', { hour12: false })}
          </Text>
        )}
      </Box>

      {/* Service cards — side by side if wide */}
      <Box flexDirection={isWide ? 'row' : 'column'} gap={1}>
        {services.map((svc) => (
          <ServiceCard key={svc.name} svc={svc} />
        ))}
      </Box>

      {/* Activity feed */}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        flexDirection="column"
      >
        <Text color="gray" dimColor>
          ── Recent Activity ──────────────────────────────────────────────
        </Text>
        {logs.length === 0 ? (
          <Text color="gray" dimColor>
            No recent activity
          </Text>
        ) : (
          logs.map((entry, i) => <LogLine key={i} entry={entry} />)
        )}
      </Box>

      {/* Quick stats */}
      <Box
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        flexDirection={isWide ? 'row' : 'column'}
        gap={isWide ? 4 : 0}
      >
        <Box gap={1}>
          <Text color="gray">Memories</Text>
          <Text color="cyan" bold>
            {stats?.totalMemories ?? '—'}
          </Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">Pending Tasks</Text>
          <Text color={stats && stats.pendingTasks > 0 ? 'yellow' : 'cyan'} bold>
            {stats?.pendingTasks ?? '—'}
          </Text>
        </Box>
        <Box gap={1}>
          <Text color="gray">API</Text>
          <Text color={services[0]?.ok ? 'green' : 'red'} bold>
            {services[0]?.ok ? 'online' : 'offline'}
          </Text>
        </Box>
      </Box>

      <Footer
        hints={[
          { key: 'r', label: 'refresh now' },
          { key: 'q / Esc', label: 'back' },
        ]}
      />
    </Box>
  );
}
