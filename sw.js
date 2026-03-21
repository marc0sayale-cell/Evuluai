const CACHE = 'evo-v9';
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

// ─── WIDGETS ────────────────────────────────────────────────────────────────
// PWA Widgets API (Chrome experimental / Android 12+)
// Quando disponível, aparece na tela inicial como widget nativo

const WIDGET_TEMPLATES = {
  calorias: {
    name: 'Evoluai — Calorias',
    description: 'Calorias consumidas hoje',
    tag: 'evoluai-calorias',
    ms_ac_template: 'evoluai-calorias.json',
    data: 'evoluai-calorias-data.json',
    screenshots: [{ src: './icon-512-1.png', sizes: '512x512' }],
    icons: [{ src: './icon-192.png', sizes: '192x192' }],
    backgrounds: ['#100319'],
    multiple: false
  },
  treino: {
    name: 'Evoluai — Treino',
    description: 'Treino do dia',
    tag: 'evoluai-treino',
    ms_ac_template: 'evoluai-treino.json',
    data: 'evoluai-treino-data.json',
    screenshots: [{ src: './icon-512-1.png', sizes: '512x512' }],
    icons: [{ src: './icon-192.png', sizes: '192x192' }],
    backgrounds: ['#100319'],
    multiple: false
  },
  financas: {
    name: 'Evoluai — Finanças',
    description: 'Saldo financeiro',
    tag: 'evoluai-financas',
    ms_ac_template: 'evoluai-financas.json',
    data: 'evoluai-financas-data.json',
    screenshots: [{ src: './icon-512-1.png', sizes: '512x512' }],
    icons: [{ src: './icon-192.png', sizes: '192x192' }],
    backgrounds: ['#100319'],
    multiple: false
  },
  motivacao: {
    name: 'Evoluai — Motivação',
    description: 'Frase motivadora do dia',
    tag: 'evoluai-motivacao',
    ms_ac_template: 'evoluai-motivacao.json',
    data: 'evoluai-motivacao-data.json',
    screenshots: [{ src: './icon-512-1.png', sizes: '512x512' }],
    icons: [{ src: './icon-192.png', sizes: '192x192' }],
    backgrounds: ['#100319'],
    multiple: false
  },
  refeicao: {
    name: 'Evoluai — Próxima Refeição',
    description: 'O que comer agora',
    tag: 'evoluai-refeicao',
    ms_ac_template: 'evoluai-refeicao.json',
    data: 'evoluai-refeicao-data.json',
    screenshots: [{ src: './icon-512-1.png', sizes: '512x512' }],
    icons: [{ src: './icon-192.png', sizes: '192x192' }],
    backgrounds: ['#100319'],
    multiple: false
  }
};

// Registrar widgets quando API disponível
self.addEventListener('activate', e => {
  if ('widgets' in self) {
    e.waitUntil(
      Promise.all(
        Object.values(WIDGET_TEMPLATES).map(t =>
          self.widgets.getByTag(t.tag).then(w => {
            if (!w) return self.widgets.updateByTag(t.tag, { template: t });
          }).catch(() => {})
        )
      )
    );
  }
});

// Frases motivadoras
const FRASES = [
  'Cada treino te aproxima do seu melhor eu! 💪',
  'Consistência é a chave. Continue! 🔑',
  'Seu único concorrente é quem você foi ontem. 🚀',
  'Pequenos passos todos os dias = grandes resultados! 🎯',
  'A disciplina de hoje é a conquista de amanhã. ⭐',
  'Você é mais forte do que pensa! 💥',
  'Foco no processo, os resultados vêm naturalmente. 🌱',
  'Não pare quando estiver cansado, pare quando terminar. 🏆',
];

function getFrasesDia() {
  const dia = new Date().getDay();
  return FRASES[dia % FRASES.length];
}

// Atualizar dados dos widgets via postMessage
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'UPDATE_WIDGETS') {
    const { kcal, metaKcal, treino, saldo, proximaRefeicao } = e.data;

    if (!('widgets' in self)) return; // API não disponível

    const updates = [
      {
        tag: 'evoluai-calorias',
        data: {
          kcal: kcal || 0,
          meta: metaKcal || 2200,
          pct: Math.min(100, Math.round(((kcal||0)/(metaKcal||2200))*100)),
          label: 'Calorias Hoje',
          cor: '#e040fb'
        }
      },
      {
        tag: 'evoluai-treino',
        data: {
          nome: treino?.nome || 'Sem treino hoje',
          tipo: treino?.tipo || 'descanso',
          duracao: treino?.duracao || 0,
          feito: treino?.feito || false,
          label: 'Treino de Hoje'
        }
      },
      {
        tag: 'evoluai-financas',
        data: {
          saldo: saldo || 0,
          positivo: (saldo || 0) >= 0,
          label: 'Saldo'
        }
      },
      {
        tag: 'evoluai-motivacao',
        data: {
          frase: getFrasesDia(),
          label: 'Motivação'
        }
      },
      {
        tag: 'evoluai-refeicao',
        data: {
          nome: proximaRefeicao?.nome || 'Nenhuma refeição',
          kcal: proximaRefeicao?.kcal || 0,
          tipo: proximaRefeicao?.tipo || '',
          label: 'Próxima Refeição'
        }
      }
    ];

    updates.forEach(u => {
      self.widgets.updateByTag(u.tag, { data: JSON.stringify(u.data) }).catch(() => {});
    });
  }
});

self.addEventListener('message',e=>{ if(e.data&&e.data.type==='SKIP_WAITING') self.skipWaiting(); });
