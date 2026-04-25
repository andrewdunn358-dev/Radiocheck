/**
 * InstallPwaPrompt — Radio Check
 *
 * Lets users install the web app to their phone home screen as a half-way
 * house ahead of native app builds. Web-only; renders nothing on iOS/Android
 * native (Platform.OS !== 'web').
 *
 * Behaviour:
 *  - Registers /sw.js (root scope) once on mount.
 *  - On Android Chrome: captures `beforeinstallprompt`, shows a small
 *    bottom-of-screen pill ("Install Radio Check"), fires the native dialog
 *    when tapped.
 *  - On iOS Safari: detects iPhone/iPad UA, shows the same pill, and on tap
 *    displays a brief instruction modal (Share → Add to Home Screen → Add).
 *  - Hides itself if the app is already running standalone.
 *  - Dismissible — sets a sessionStorage flag so it doesn't reappear on
 *    every navigation in the same session.
 *
 * Privacy: SW does NOT cache chat content. Pure pass-through to network.
 */

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, Modal } from 'react-native';

const DISMISS_KEY = 'rc_install_prompt_dismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPwaPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    // Honour previous dismissal in the same session
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY) === '1') {
        setDismissed(true);
      }
    } catch {
      // sessionStorage may be blocked (private mode etc.) — non-fatal
    }

    // Register service worker — required for Chrome install eligibility.
    // Scope is left as origin-default so the same SW covers the whole app.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration failure is non-fatal */
      });
    }

    // Detect iOS Safari (no programmatic install — instructions only).
    const ua = window.navigator.userAgent || '';
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(iosDetected);

    // Detect already-installed (standalone display mode).
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standalone);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setIsInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || isInstalled || dismissed) return null;
  if (!installEvent && !isIos) return null;

  const onTap = async () => {
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice?.outcome === 'accepted') setIsInstalled(true);
      } catch {
        /* user closed or browser blocked — non-fatal */
      } finally {
        setInstallEvent(null);
      }
    } else if (isIos) {
      setShowIosInstructions(true);
    }
  };

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* non-fatal */
    }
  };

  return (
    <>
      <View
        // @ts-ignore — `position: fixed` is web-only and intentional here.
        style={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: [{ translateX: -160 }] as unknown as string,
          width: 320,
          zIndex: 9999,
          backgroundColor: '#1e3a8a',
          borderRadius: 24,
          paddingVertical: 10,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35,
          shadowRadius: 16,
          elevation: 12,
        }}
        // @ts-ignore — DOM data attribute for testing on web
        dataSet={{ testid: 'install-pwa-prompt' }}
      >
        <Pressable
          onPress={onTap}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          // @ts-ignore
          dataSet={{ testid: 'install-pwa-button' }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>{'\u2B07'}</Text>
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
            Install Radio Check on this phone
          </Text>
        </Pressable>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          // @ts-ignore
          dataSet={{ testid: 'install-pwa-dismiss' }}
          style={{ paddingLeft: 10 }}
        >
          <Text style={{ color: '#cbd5e1', fontSize: 18 }}>{'\u2715'}</Text>
        </Pressable>
      </View>

      <Modal
        visible={showIosInstructions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIosInstructions(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: '#0f1419',
              borderColor: '#2d3748',
              borderWidth: 1,
              borderRadius: 16,
              padding: 18,
              maxWidth: 360,
              width: '100%',
            }}
            // @ts-ignore
            dataSet={{ testid: 'install-pwa-ios-modal' }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              Install on iPhone
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
              iOS doesn&apos;t allow apps to install themselves. To add Radio Check to your home
              screen:
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 6 }}>
              1. Tap the <Text style={{ fontWeight: '700' }}>Share</Text> button at the bottom of
              Safari (the square with the up arrow).
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 6 }}>
              2. Scroll down and tap <Text style={{ fontWeight: '700' }}>Add to Home Screen</Text>.
            </Text>
            <Text style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 18, marginBottom: 14 }}>
              3. Tap <Text style={{ fontWeight: '700' }}>Add</Text> in the top right.
            </Text>
            <Text style={{ color: '#94a3b8', fontSize: 11, lineHeight: 16, marginBottom: 14 }}>
              It will appear on your home screen with the Radio Check icon and open like a normal
              app — no browser bars.
            </Text>
            <Pressable
              onPress={() => setShowIosInstructions(false)}
              style={{
                backgroundColor: '#3b82f6',
                paddingVertical: 12,
                borderRadius: 10,
                alignItems: 'center',
              }}
              // @ts-ignore
              dataSet={{ testid: 'install-pwa-ios-dismiss' }}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}
