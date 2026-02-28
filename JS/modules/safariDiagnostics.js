function isIOSSafari() {
  const ua = navigator.userAgent || '';
  const iOS = /iP(hone|ad|od)/i.test(ua);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return iOS && safari;
}

export function createSafariDiagnostics(enabled = isIOSSafari()) {
  const timings = new Map();

  const log = (label, payload = {}) => {
    if (!enabled) return;
    console.log(`[safari-diag] ${label}`, payload);
  };

  const markStart = (name) => {
    if (!enabled) return;
    timings.set(name, performance.now());
  };

  const markEnd = (name, extra = {}) => {
    if (!enabled) return;
    const start = timings.get(name);
    const durationMs = typeof start === 'number' ? (performance.now() - start) : null;
    log(`${name}:end`, { durationMs, ...extra });
    timings.delete(name);
  };

  const captureDomMediaStats = (root = document) => {
    if (!enabled) return;
    const nodes = root.querySelectorAll('*').length;
    const images = root.querySelectorAll('img').length;
    const videos = root.querySelectorAll('video').length;
    const playingVideos = Array.from(root.querySelectorAll('video')).filter((v) => !v.paused).length;
    log('dom-media', { nodes, images, videos, playingVideos });
  };

  const mediaPlayRejected = (src, error) => {
    if (!enabled) return;
    log('video-play-rejected', {
      src,
      name: error?.name || 'UnknownError',
      message: error?.message || 'Unknown error'
    });
  };

  return {
    enabled,
    log,
    markStart,
    markEnd,
    captureDomMediaStats,
    mediaPlayRejected
  };
}
