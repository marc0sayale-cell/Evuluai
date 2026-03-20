const CACHE = 'evo-v8';
const SKIP = ['api.groq', 'api.anthropic', 'firebase', 'googleapis', 'workers.dev', 'cloudflare'];

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (SKIP.some(s => e.request.url.includes(s))) return;
  e.respondWith(
    caches.open(CACHE).then(c =>
      c.match(e.request).then(r =>
        r || fetch(e.request).then(res => {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => r)
      )
    )
  );
});

// ─── NOTIFICAÇÕES VIA SERVICE WORKER ───────────────────────────────────────
// Armazena timers de notificação
let _notifTimers = [];

self.addEventListener('message', e => {
  if (!e.data) return;

  // Cancelar todos os timers
  if (e.data.type === 'CLEAR_NOTIFS') {
    _notifTimers.forEach(t => clearTimeout(t));
    _notifTimers = [];
    return;
  }

  // Agendar notificações
  if (e.data.type === 'SCHEDULE_NOTIFS') {
    const { cfg } = e.data;
    if (!cfg) return;

    // Limpar timers antigos
    _notifTimers.forEach(t => clearTimeout(t));
    _notifTimers = [];

    const now = new Date();

    // ─── ÁGUA: intervalo em horas ────────────────────────────────────────
    if (cfg.agua) {
      const msInterval = (parseInt(cfg.agua_int) || 2) * 60 * 60 * 1000;
      const msgs = [
        'Beba um copo de água agora! 💧',
        'Hora de se hidratar! 💧',
        'Você bebeu água recentemente? 💧'
      ];
      function agendarAgua(delay) {
        const t = setTimeout(() => {
          self.registration.showNotification('Evoluai — Hidratação', {
            body: msgs[Math.floor(Math.random() * msgs.length)],
            tag: 'agua-' + Date.now(),
            vibrate: [200, 100, 200]
          }).catch(() => {});
          agendarAgua(msInterval); // Reagendar
        }, delay);
        _notifTimers.push(t);
      }
      agendarAgua(msInterval); // Primeira notificação após o intervalo
    }

    // ─── TREINO: horário fixo ─────────────────────────────────────────────
    if (cfg.treino && cfg.treino_hr) {
      const [h, m] = cfg.treino_hr.split(':').map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target - now;
      function agendarTreino(d) {
        const t = setTimeout(() => {
          self.registration.showNotification('Hora do Treino! 💪', {
            body: 'Bora treinar hoje! Seu plano está esperando.',
            tag: 'treino-' + Date.now(),
            vibrate: [200, 100, 200]
          }).catch(() => {});
          agendarTreino(24 * 60 * 60 * 1000); // Repetir amanhã
        }, d);
        _notifTimers.push(t);
      }
      agendarTreino(delay);
    }

    // ─── REFEIÇÕES: 3 horários fixos ──────────────────────────────────────
    if (cfg.refeicao) {
      const refeicoes = [
        { hr: '08:00', titulo: 'Café da manhã ☀️', corpo: 'Não esqueça de registrar seu café da manhã!' },
        { hr: '12:30', titulo: 'Almoço 🍽️', corpo: 'Hora do almoço! Registre sua refeição.' },
        { hr: '19:00', titulo: 'Jantar 🌙', corpo: 'Registre seu jantar para manter o controle!' }
      ];
      refeicoes.forEach(ref => {
        const [h, m] = ref.hr.split(':').map(Number);
        const target = new Date(now);
        target.setHours(h, m, 0, 0);
        if (target <= now) target.setDate(target.getDate() + 1);
        const delay = target - now;
        function agendarRef(d) {
          const t = setTimeout(() => {
            self.registration.showNotification(ref.titulo, {
              body: ref.corpo,
              tag: 'refeicao-' + ref.hr,
              vibrate: [200, 100, 200]
            }).catch(() => {});
            agendarRef(24 * 60 * 60 * 1000);
          }, d);
          _notifTimers.push(t);
        }
        agendarRef(delay);
      });
    }

    // ─── PESO: horário fixo ───────────────────────────────────────────────
    if (cfg.peso && cfg.peso_hr) {
      const [h, m] = cfg.peso_hr.split(':').map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target - now;
      function agendarPeso(d) {
        const t = setTimeout(() => {
          self.registration.showNotification('Registre seu peso 📊', {
            body: 'Pesou hoje? Acompanhe sua evolução no Evoluai.',
            tag: 'peso-' + Date.now(),
            vibrate: [200, 100, 200]
          }).catch(() => {});
          agendarPeso(24 * 60 * 60 * 1000);
        }, d);
        _notifTimers.push(t);
      }
      agendarPeso(delay);
    }

    return;
  }

  // Notificação imediata (teste)
  if (e.data.type === 'SHOW_NOTIF') {
    self.registration.showNotification(e.data.title || 'Evoluai', {
      body: e.data.body || 'Notificação de teste',
      tag: 'test-' + Date.now(),
      vibrate: [200, 100, 200]
    }).catch(() => {});
    return;
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cls => {
      const w = cls.find(c => 'focus' in c);
      return w ? w.focus() : clients.openWindow('./');
    })
  );
});
