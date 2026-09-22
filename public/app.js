const API_BASE = '';
let adminToken = sessionStorage.getItem('adminToken') || '';
let currentView = 'board';
let pollTimer = null;

/* ===== View Switching ===== */
function switchView(view) {
  if (view === 'admin' && !adminToken) {
    view = 'login';
  }
  if (view === 'login' && adminToken) {
    view = 'admin';
  }

  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.remove('active'));

  const target = document.getElementById('view-' + view);
  if (target) {
    target.classList.add('active');
    currentView = view;
  }

  if (view === 'admin') {
    loadAdminList();
  } else if (view === 'board') {
    loadNotices();
  }
}

/* ===== Time Helpers ===== */
function formatTime(ts) {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 2592000000) return Math.floor(diff / 86400000) + ' 天前';
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatFullTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function pad(n) { return String(n).padStart(2, '0'); }

/* ===== Clock ===== */
function updateClock() {
  const d = new Date();
  const el = document.getElementById('navTime');
  if (el) el.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ===== Toast ===== */
function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

/* ===== API ===== */
async function api(path, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (adminToken) headers['X-Admin-Token'] = adminToken;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}

/* ===== Auth ===== */
async function login(e) {
  e.preventDefault();
  const password = document.getElementById('loginPassword').value;
  try {
    const data = await api('/api/admin/login', 'POST', { password });
    adminToken = data.token;
    sessionStorage.setItem('adminToken', adminToken);
    toast('登录成功', 'success');
    updateNavState();
    switchView('admin');
  } catch (err) {
    toast(err.message, 'error');
  }
  return false;
}

function logout() {
  adminToken = '';
  sessionStorage.removeItem('adminToken');
  toast('已退出登录', 'info');
  updateNavState();
  switchView('board');
}

function updateNavState() {
  const adminBtn = document.getElementById('navAdminBtn');
  const logoutBtn = document.getElementById('navLogoutBtn');
  if (adminToken) {
    adminBtn.textContent = '管理面板';
    adminBtn.onclick = () => switchView('admin');
    logoutBtn.classList.remove('nav-btn--hidden');
  } else {
    adminBtn.textContent = '管理员';
    adminBtn.onclick = () => switchView('login');
    logoutBtn.classList.add('nav-btn--hidden');
  }
}

/* ===== Load Notices (Public) ===== */
async function loadNotices() {
  try {
    const data = await api('/api/notifications');
    renderNotices(data);
    document.getElementById('statTotal').textContent = data.length;
  } catch (err) {
    toast('加载失败: ' + err.message, 'error');
  }
}

function renderNotices(notices) {
  const list = document.getElementById('noticeList');
  if (notices.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">—</div><p>暂无通知</p></div>`;
    return;
  }
  const pinned = notices.filter(n => n.pinned);
  const normal = notices.filter(n => !n.pinned);
  const ordered = [...pinned, ...normal];

  list.innerHTML = ordered.map((n, i) => `
    <div class="notice-card${n.pinned ? ' pinned' : ''}" data-level="${n.level}" style="animation-delay:${i * 0.06}s">
      <div class="notice-card-head">
        <div class="notice-title-row">
          <span class="notice-level" data-level="${n.level}">${levelText(n.level)}</span>
          ${n.pinned ? '<span class="notice-pin-badge">&#9733; 置顶</span>' : ''}
        </div>
        <span class="notice-time">${formatTime(n.timestamp)}</span>
      </div>
      <h3 class="notice-title">${escapeHtml(n.title)}</h3>
      ${n.content ? `<div class="notice-content">${escapeHtml(n.content)}</div>` : ''}
    </div>
  `).join('');
}

function levelText(level) {
  return { normal: '普通', important: '重要', urgent: '紧急' }[level] || '普通';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

/* ===== Admin: Publish ===== */
async function publishNotice(e) {
  e.preventDefault();
  const title = document.getElementById('noticeTitle').value.trim();
  const content = document.getElementById('noticeContent').value.trim();
  const level = document.querySelector('input[name="level"]:checked').value;

  if (!title || !content) {
    toast('标题和内容不能为空', 'error');
    return false;
  }

  try {
    await api('/api/notifications', 'POST', { title, content, level });
    toast('发布成功', 'success');
    document.getElementById('noticeTitle').value = '';
    document.getElementById('noticeContent').value = '';
    document.querySelector('input[name="level"][value="normal"]').checked = true;
    loadAdminList();
  } catch (err) {
    toast('发布失败: ' + err.message, 'error');
  }
  return false;
}

/* ===== Admin: List ===== */
async function loadAdminList() {
  try {
    const data = await api('/api/notifications');
    document.getElementById('adminCount').textContent = data.length;
    renderAdminList(data);
  } catch (err) {
    toast('加载失败', 'error');
  }
}

function renderAdminList(notices) {
  const list = document.getElementById('adminList');
  if (notices.length === 0) {
    list.innerHTML = `<div class="empty-state small"><p>暂无通知</p></div>`;
    return;
  }
  list.innerHTML = notices.map(n => `
    <div class="admin-item">
      <div class="admin-item-head">
        <span class="notice-level" data-level="${n.level}">${levelText(n.level)}</span>
        <span class="admin-item-time">${formatFullTime(n.timestamp)}</span>
      </div>
      <div class="admin-item-title">${escapeHtml(n.title)}</div>
      <div class="admin-item-preview">${escapeHtml(n.content.slice(0, 80))}${n.content.length > 80 ? '...' : ''}</div>
      <div class="admin-item-actions">
        <button class="action-btn${n.pinned ? ' action-btn--active' : ''}" onclick="togglePin('${n.id}')">
          ${n.pinned ? '取消置顶' : '置顶'}
        </button>
        <button class="action-btn action-btn--danger" onclick="deleteNotice('${n.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

async function togglePin(id) {
  try {
    await api(`/api/notifications/${id}/pin`, 'PUT');
    loadAdminList();
    toast('已更新', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteNotice(id) {
  if (!confirm('确定删除这条通知？')) return;
  try {
    await api(`/api/notifications/${id}`, 'DELETE');
    loadAdminList();
    toast('已删除', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ===== Polling ===== */
function startPolling() {
  stopPolling();
  pollTimer = setInterval(() => {
    loadNotices();
    if (currentView === 'admin') loadAdminList();
  }, 2000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ===== QR Code ===== */
async function showQRCode() {
  try {
    const data = await api('/api/qrcode');
    document.getElementById('qrImage').src = data.qr;
    document.getElementById('qrUrl').textContent = data.url;
    document.getElementById('qrModal').classList.add('active');
  } catch (err) {
    toast('生成二维码失败', 'error');
  }
}

function closeQRCode() {
  document.getElementById('qrModal').classList.remove('active');
}

/* ===== Init ===== */
updateNavState();
loadNotices();
startPolling();
