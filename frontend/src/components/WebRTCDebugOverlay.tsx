/**
 * WebRTCDebugOverlay
 *
 * Read-only floating panel that surfaces WebRTC diagnostic state on mobile
 * for users who cannot easily attach DevTools to their device.
 *
 * - DEFAULT OFF. Renders nothing unless one of:
 *     - URL has `?debug=1` (or `?webrtc-debug=1`)
 *     - localStorage.WEBRTC_DEBUG === '1'
 * - Pure observer: reads the props passed from the hook / component and
 *   displays them. No effect on call signalling, state, or UI.
 * - Auto-expands when an error is present; otherwise collapsible.
 *
 * Intentionally NOT mounted in production paths by default. Consumers must
 * import and conditionally include it.
 */

import React, { useEffect, useState } from 'react';
import { Platform, View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';

import type {
  WebRTCErrorInfo,
  WebRTCStep,
} from '../../../hooks/useWebRTCCallWeb';

export interface WebRTCDebugOverlayProps {
  /** Current high-level call state from the hook */
  callState?: string;
  /** Last captured error (one stage's worth) */
  lastError?: WebRTCErrorInfo | null;
  /** Recent step ring buffer */
  recentSteps?: WebRTCStep[];
  /** Whether the socket reports connected */
  socketConnected?: boolean;
  /** Optional: live ICE state from the peer connection if exposed */
  iceConnectionState?: string;
  /**
   * Optional explicit notice. Used on screens that intentionally render the
   * overlay WITHOUT mounting the `useWebRTCCall` hook to surface that the
   * screen has no WebRTC handler (so incoming offers would be silently
   * discarded). Read-only — overlay just displays the text.
   */
  notice?: string;
}

const isDebugEnabled = (): boolean => {
  if (Platform.OS !== 'web') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') return true;
    if (params.get('webrtc-debug') === '1') return true;
    if (window.localStorage?.getItem('WEBRTC_DEBUG') === '1') return true;
  } catch {
    // SSR / sandbox environments where window/localStorage isn't reachable
  }
  return false;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute' as const,
    left: 8,
    bottom: 8,
    maxWidth: 340,
    minWidth: 240,
    backgroundColor: 'rgba(15, 15, 20, 0.92)',
    borderRadius: 8,
    padding: 10,
    zIndex: 99999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    color: '#fff',
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  label: {
    color: '#aaa',
    fontSize: 10,
  },
  value: {
    color: '#fff',
    fontSize: 10,
    flexShrink: 1,
    marginLeft: 8,
    textAlign: 'right' as const,
  },
  errorBox: {
    backgroundColor: 'rgba(220, 38, 38, 0.25)',
    borderRadius: 4,
    padding: 6,
    marginTop: 6,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 10,
  },
  noticeBox: {
    backgroundColor: 'rgba(217, 119, 6, 0.25)',
    borderRadius: 4,
    padding: 6,
    marginBottom: 6,
  },
  noticeText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '600',
  },
  stepLine: {
    color: '#cbd5e1',
    fontSize: 9,
    fontFamily: Platform.OS === 'web' ? ('monospace' as const) : undefined,
    marginVertical: 0,
  },
  collapsedHint: {
    color: '#94a3b8',
    fontSize: 9,
    marginTop: 4,
  },
  toggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  toggleText: {
    color: '#93c5fd',
    fontSize: 11,
  },
});

export const WebRTCDebugOverlay: React.FC<WebRTCDebugOverlayProps> = (props) => {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<boolean>(true);

  // Resolve enabled flag client-side only.
  useEffect(() => {
    setEnabled(isDebugEnabled());
  }, []);

  // Auto-expand on error.
  useEffect(() => {
    if (props.lastError) setExpanded(true);
  }, [props.lastError]);

  if (!enabled) return null;
  if (Platform.OS !== 'web') return null;

  const { callState, lastError, recentSteps, socketConnected, iceConnectionState, notice } = props;

  const tailSteps = (recentSteps ?? []).slice(-10);

  return (
    <View style={styles.container} accessibilityLabel="webrtc-debug-overlay" pointerEvents="box-none">
      <View style={styles.header}>
        <Text style={styles.title}>WebRTC diagnostic</Text>
        <Pressable onPress={() => setExpanded((v) => !v)} style={styles.toggleBtn}>
          <Text style={styles.toggleText}>{expanded ? 'collapse' : 'expand'}</Text>
        </Pressable>
      </View>

      {notice ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeText}>⚠ {notice}</Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <Text style={styles.label}>callState</Text>
        <Text style={styles.value}>{callState ?? '—'}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>socket</Text>
        <Text style={styles.value}>{socketConnected ? 'connected' : 'disconnected'}</Text>
      </View>
      {iceConnectionState ? (
        <View style={styles.row}>
          <Text style={styles.label}>iceConnectionState</Text>
          <Text style={styles.value}>{iceConnectionState}</Text>
        </View>
      ) : null}

      {expanded && lastError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            [{lastError.stage}] {lastError.message}
          </Text>
        </View>
      ) : null}

      {expanded ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.label}>recent steps (last {tailSteps.length})</Text>
          <ScrollView style={{ maxHeight: 140 }}>
            {tailSteps.length === 0 ? (
              <Text style={styles.stepLine}>—</Text>
            ) : (
              tailSteps.map((s, i) => (
                <Text key={`${s.timestamp}-${i}`} style={styles.stepLine} numberOfLines={2}>
                  {s.timestamp.slice(11, 19)}  {s.name}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.collapsedHint}>{(recentSteps?.length ?? 0)} steps recorded</Text>
      )}
    </View>
  );
};

export default WebRTCDebugOverlay;
