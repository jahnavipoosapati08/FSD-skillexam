(() => {
  const $ = (id) => document.getElementById(id);
  let mode = 'login';          // 'login' | 'register'
  let editingId = null;        // movie being edited, or null when adding
  let pendingDeleteId = null;
  let debounce;

  async function api(path, method = 'GET', body) {
    const res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'movie-club' },
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && path !== '/auth/login') showSignedOut();
      throw new Error(data.error || 'Request failed.');
    }
    return data;
  }

  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  // ---------- Session ----------
  function showSignedIn(user) {
    $('auth').hidden = true;
    $('app').hidden = false;
    $('session').hidden = false;
    $('who').textContent = user.name + (user.role === 'admin' ? ' (admin)' : '');
    loadMovies();
  }
  function showSignedOut() {
    $('auth').hidden = false;
    $('app').hidden = true;
    $('session').hidden = true;
    $('rows').replaceChildren();
  }

  function setMode(next) {
    mode = next;
    const reg = mode === 'register';
    $('auth-title').textContent = reg ? 'Create your club account' : 'Sign in to the club register';
    $('auth-submit').textContent = reg ? 'Create account' : 'Sign in';
    $('name-row').hidden = !reg;
    $('swap-text').textContent = reg ? 'Already a member?' : 'New to the club?';
    $('swap').textContent = reg ? 'Sign in' : 'Create an account';
    $('auth-form').password.autocomplete = reg ? 'new-password' : 'current-password';
    $('auth-error').textContent = '';
  }
  $('swap').addEventListener('click', () => setMode(mode === 'login' ? 'register' : 'login'));

  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    $('auth-error').textContent = '';
    try {
      const user = await api(mode === 'register' ? '/auth/register' : '/auth/login', 'POST', {
        name: f.name.value, email: f.email.value, password: f.password.value,
      });
      f.reset();
      showSignedIn(user);
    } catch (err) { $('auth-error').textContent = err.message; }
  });

  $('logout').addEventListener('click', async () => {
    await api('/auth/logout', 'POST').catch(() => {});
    showSignedOut();
  });

  // ---------- List ----------
  async function loadMovies() {
    $('list-error').textContent = '';
    const params = new URLSearchParams();
    if ($('q').value.trim()) params.set('q', $('q').value.trim());
    if ($('genre-filter').value) params.set('genre', $('genre-filter').value);
    try {
      const movies = await api('/movies?' + params);
      renderRows(movies);
      if (!params.toString()) fillGenres(movies);
    } catch (err) { $('list-error').textContent = err.message; }
  }

  function fillGenres(movies) {
    const sel = $('genre-filter');
    const current = sel.value;
    const genres = [...new Set(movies.map((m) => m.genre))].sort();
    sel.replaceChildren(new Option('All genres', ''), ...genres.map((g) => new Option(g, g)));
    sel.value = current;
  }

  function cell(text, cls) {
    const s = document.createElement('span');
    s.textContent = text;
    if (cls) s.className = cls;
    return s;
  }

  function renderRows(movies) {
    $('empty').hidden = movies.length > 0;
    $('rows').replaceChildren(...movies.map((m) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');

      const title = document.createElement('span');
      const open = document.createElement('button');
      open.className = 'title-btn';
      open.textContent = m.title;
      open.addEventListener('click', () => showDetails(m._id));
      title.append(open);

      const actions = document.createElement('span');
      actions.className = 'row-actions';
      if (m.canModify) {
        const edit = document.createElement('button');
        edit.className = 'ghost'; edit.textContent = 'Edit';
        edit.setAttribute('aria-label', 'Edit ' + m.title);
        edit.addEventListener('click', () => openForm(m));
        const del = document.createElement('button');
        del.className = 'ghost'; del.textContent = 'Delete';
        del.setAttribute('aria-label', 'Delete ' + m.title);
        del.addEventListener('click', () => askDelete(m));
        actions.append(edit, del);
      }

      row.append(cell(Number(m.rating).toFixed(1), 'num'), title, cell(m.genre), cell(fmtDate(m.releaseDate) ), cell(m.director), actions);
      return row;
    }));
  }

  $('q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(loadMovies, 250); });
  $('genre-filter').addEventListener('change', loadMovies);

  // ---------- View details ----------
  async function showDetails(id) {
    try {
      const m = await api('/movies/' + id);
      $('d-title').textContent = m.title;
      const items = [
        ['Genre', m.genre], ['Release date', fmtDate(m.releaseDate)], ['Year', String(m.year)],
        ['Rating', m.rating + ' / 10'], ['Director', m.director], ['Added by', m.addedBy],
      ];
      $('d-list').replaceChildren(...items.flatMap(([k, v]) => {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        return [dt, dd];
      }));
      $('detail-dialog').showModal();
    } catch (err) { $('list-error').textContent = err.message; }
  }
  $('d-close').addEventListener('click', () => $('detail-dialog').close());

  // ---------- Add / update ----------
  function openForm(movie) {
    const f = $('movie-form');
    f.reset();
    $('form-error').textContent = '';
    editingId = movie ? movie._id : null;
    $('form-title').textContent = movie ? 'Edit movie' : 'Add movie';
    if (movie) {
      f.title.value = movie.title; f.genre.value = movie.genre; f.director.value = movie.director;
      f.rating.value = movie.rating; f.releaseDate.value = movie.releaseDate.slice(0, 10);
    }
    $('form-dialog').showModal();
  }
  $('add').addEventListener('click', () => openForm(null));
  $('form-cancel').addEventListener('click', () => $('form-dialog').close());

  $('movie-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      title: f.title.value, genre: f.genre.value, director: f.director.value,
      releaseDate: f.releaseDate.value, rating: f.rating.value,
    };
    try {
      await (editingId ? api('/movies/' + editingId, 'PUT', body) : api('/movies', 'POST', body));
      $('form-dialog').close();
      loadMovies();
    } catch (err) { $('form-error').textContent = err.message; }
  });

  // ---------- Delete ----------
  function askDelete(movie) {
    pendingDeleteId = movie._id;
    $('confirm-text').textContent = `"${movie.title}" will be removed from the club register.`;
    $('confirm-dialog').showModal();
  }
  $('confirm-dialog').addEventListener('close', async () => {
    if ($('confirm-dialog').returnValue !== 'ok' || !pendingDeleteId) return;
    try { await api('/movies/' + pendingDeleteId, 'DELETE'); loadMovies(); }
    catch (err) { $('list-error').textContent = err.message; }
    pendingDeleteId = null;
  });

  // ---------- Start ----------
  api('/auth/me').then(showSignedIn).catch(() => {});
})();
