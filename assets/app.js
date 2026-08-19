document.addEventListener('DOMContentLoaded', () => {
    const appRoot = document.getElementById('app-root');
    const logoutBtn = document.getElementById('logoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('api/login.php', { method: 'DELETE' });
            window.location.hash = '#login';
            window.location.reload();
        });
    }

    function renderLoading() {
        const tpl = document.getElementById('tpl-loading');
        appRoot.innerHTML = '';
        appRoot.appendChild(tpl.content.cloneNode(true));
    }

    async function navigate() {
        const hash = window.location.hash || '#tournaments';
        renderLoading();

        if (hash === '#login') {
            renderLogin();
        } else if (hash === '#tournaments') {
            renderTournaments();
        } else if (hash === '#new-tournament') {
            renderNewTournament();
        } else if (hash.startsWith('#tournament/')) {
            const id = hash.split('/')[1];
            renderTournamentDetail(id);
        } else {
            appRoot.innerHTML = '<div class="card text-center"><h1>404 Not Found</h1></div>';
        }
    }

    function renderLogin() {
        appRoot.innerHTML = `
            <div class="card" style="max-width: 400px; margin: 4rem auto;">
                <h2 class="mb-4 text-center">Admin Login</h2>
                <form id="loginForm">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" id="username" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="password" class="form-control" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Login</button>
                    <p id="loginError" style="color: var(--danger); margin-top: 1rem; text-align: center; display: none;">Invalid credentials</p>
                </form>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('api/login.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: document.getElementById('username').value,
                    password: document.getElementById('password').value
                })
            });
            if (res.ok) {
                window.location.hash = '#tournaments';
                window.location.reload();
            } else {
                document.getElementById('loginError').style.display = 'block';
            }
        });
    }

    async function renderTournaments() {
        const res = await fetch('api/tournaments.php');
        const tournaments = await res.json();
        
        let html = `
            <div class="page-header">
                <h1>Tournaments</h1>
                ${window.isAdmin ? '<a href="#new-tournament" class="btn btn-primary">+ New Tournament</a>' : ''}
            </div>
            <div class="grid grid-cols-2">
        `;

        if (tournaments.length === 0) {
            html += `<div class="card" style="grid-column: 1/-1;"><p class="text-muted text-center">No tournaments found.</p></div>`;
        } else {
            tournaments.forEach(t => {
                html += `
                    <a href="#tournament/${t.id}" class="card" style="display: block; transition: transform 0.2s;">
                        <div class="flex justify-between items-center mb-4">
                            <h3 style="color: var(--text-main);">${t.name}</h3>
                            <span class="badge badge-${t.status}">${t.status}</span>
                        </div>
                        <p style="color: var(--text-muted); font-size: 0.9rem;">
                            Rounds: ${t.rounds_count} | Time: ${t.time_control}
                        </p>
                    </a>
                `;
            });
        }
        
        html += `</div>`;
        appRoot.innerHTML = html;
    }

    function renderNewTournament() {
        appRoot.innerHTML = `
            <div class="card" style="max-width: 600px; margin: 0 auto;">
                <h2 class="mb-4">Create Tournament</h2>
                <form id="newTournamentForm">
                    <div class="form-group">
                        <label class="form-label">Name</label>
                        <input type="text" id="t-name" class="form-control" required placeholder="e.g. Summer Open 2026">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Slug</label>
                        <input type="text" id="t-slug" class="form-control" required placeholder="summer-open-2026">
                    </div>
                    <div class="grid grid-cols-2">
                        <div class="form-group">
                            <label class="form-label">Rounds</label>
                            <input type="number" id="t-rounds" class="form-control" value="7" min="1" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Time Control</label>
                            <input type="text" id="t-time" class="form-control" value="10+5" required>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary mt-4">Create</button>
                </form>
            </div>
        `;

        const nameInput = document.getElementById('t-name');
        const slugInput = document.getElementById('t-slug');
        
        nameInput.addEventListener('input', () => {
            if (!slugInput.value || slugInput.value === nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')) {
                slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            }
        });

        document.getElementById('newTournamentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await fetch('api/tournaments.php', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    name: nameInput.value,
                    slug: slugInput.value,
                    rounds_count: document.getElementById('t-rounds').value,
                    time_control: document.getElementById('t-time').value
                })
            });
            if (res.ok) {
                const created = await res.json();
                window.location.hash = '#tournament/' + created.id;
            } else {
                alert('Error creating tournament');
            }
        });
    }

    async function renderTournamentDetail(id, initialTab = 'standings', initialRound = null) {
        // We fetch tournament info, players, rounds and standings
        const [tRes, pRes, rRes] = await Promise.all([
            fetch('api/tournaments.php?id=' + id),
            fetch('api/players.php?tournament_id=' + id),
            fetch('api/rounds.php?tournament_id=' + id + '&standings=true')
        ]);

        const t = await tRes.json();
        const players = await pRes.json();
        const data = await rRes.json();
        const rounds = data.rounds;
        const standings = data.standings;

        let activeTab = initialTab;
        let activeRound = initialRound || (rounds.length > 0 ? rounds[rounds.length - 1].number : null);

        // Pre-compute seeds based on rating
        const sortedForSeed = [...players].sort((a,b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return a.name.localeCompare(b.name);
        });
        const playerSeeds = {};
        sortedForSeed.forEach((p, idx) => {
            playerSeeds[p.id] = idx + 1;
        });
        
        function formatPlayerName(pId) {
            if (!pId) return 'Unknown';
            const pl = players.find(x => x.id == pId);
            if (!pl) return 'Unknown';
            return `(${playerSeeds[pl.id]}) ${pl.name}`;
        }
        
        function render() {
            let html = `
                <div class="page-header">
                    <div>
                        <h1>${t.name}</h1>
                        <p class="text-muted mt-4">Rounds: ${rounds.length} / ${t.rounds_count} &nbsp;&bull;&nbsp; Players: ${players.length}</p>
                    </div>
                </div>
                
                <div class="tabs">
                    <div class="tab ${activeTab === 'standings' ? 'active' : ''}" data-tab="standings">Standings</div>
                    <div class="tab ${activeTab === 'rounds' ? 'active' : ''}" data-tab="rounds">Rounds</div>
                    <div class="tab ${activeTab === 'players' ? 'active' : ''}" data-tab="players">Players</div>
                </div>
            `;

            if (activeTab === 'standings') {
                html += `<div class="card table-container"><table>
                    <thead><tr>
                        <th>Rk</th><th>Name</th><th>Rating</th><th>Pts</th><th>BH</th><th>SB</th>
                    </tr></thead><tbody>`;
                standings.forEach(s => {
                    html += `<tr>
                        <td>${s.rank}</td>
                        <td style="font-weight: 500; color: white;">${s.name}</td>
                        <td>${s.rating}</td>
                        <td style="font-weight: 700; color: var(--primary);">${s.score}</td>
                        <td>${s.buchholz}</td>
                        <td>${s.sonnebornBerger}</td>
                    </tr>`;
                });
                if (standings.length === 0) html += `<tr><td colspan="6" class="text-center text-muted">No standings available yet</td></tr>`;
                html += `</tbody></table></div>`;
            } else if (activeTab === 'rounds') {
                html += `<div class="card mb-4 flex justify-between items-center">
                    <h3 class="mt-4">Pairings & Results</h3>
                    ${window.isAdmin && (rounds.length === 0 || rounds[rounds.length-1].status === 'completed') && rounds.length < t.rounds_count ? `<button id="btnGenerateRound" class="btn btn-primary">Generate Next Round</button>` : ''}
                </div>`;
                
                if (rounds.length > 0) {
                    html += `<div class="tabs" style="margin-bottom: 1rem;">`;
                    rounds.forEach(r => {
                        html += `<div class="tab ${activeRound == r.number ? 'active' : ''}" data-round="${r.number}">Round ${r.number}</div>`;
                    });
                    html += `</div>`;
                    
                    const r = rounds.find(rx => rx.number == activeRound) || rounds[rounds.length - 1];
                    
                    html += `<div class="card mb-4">
                        <div class="flex justify-between items-center mb-4">
                            <h4>Round ${r.number}</h4>
                            <span class="badge badge-${r.status}">${r.status}</span>
                        </div>
                        <div class="table-container"><table>
                            <thead><tr><th>Bd</th><th>White</th><th>Result</th><th>Black</th></tr></thead>
                            <tbody>`;
                    r.pairings.forEach(p => {
                        let wName = p.is_bye ? 'BYE' : formatPlayerName(p.white_id);
                        let bName = p.is_bye ? formatPlayerName(p.bye_for_id) : formatPlayerName(p.black_id);
                        
                        let resultHtml = p.result || '-';
                        if (r.status === 'draft' && !p.is_bye && window.isAdmin) {
                            resultHtml = `
                                <select class="form-control result-select" data-pairing="${p.id}" style="width: 100px; padding: 0.2rem;">
                                    <option value="" ${!p.result ? 'selected' : ''}>-</option>
                                    <option value="1-0" ${p.result === '1-0' ? 'selected' : ''}>1-0</option>
                                    <option value="1/2" ${p.result === '1/2' ? 'selected' : ''}>1/2</option>
                                    <option value="0-1" ${p.result === '0-1' ? 'selected' : ''}>0-1</option>
                                </select>
                            `;
                        }
                        
                        html += `<tr>
                            <td>${p.board}</td>
                            <td>${wName}</td>
                            <td style="font-weight: bold; text-align: center;">${resultHtml}</td>
                            <td>${bName}</td>
                        </tr>`;
                    });
                    html += `</tbody></table></div>`;
                    
                    if (r.status === 'draft' && window.isAdmin) {
                        html += `<div class="flex" style="justify-content: flex-end; margin-top: -1rem; margin-bottom: 2rem;">
                            <button class="btn btn-success" id="btnCompleteRound" data-round="${r.id}">Complete Round ${r.number}</button>
                        </div>`;
                    }
                } else {
                    html += `<div class="card"><div class="text-center text-muted" style="padding: 2rem 0;">No rounds generated yet.</div></div>`;
                }
            } else if (activeTab === 'players') {
                if (window.isAdmin) {
                    html += `<div class="card mb-4">
                        <form id="addPlayerForm" class="flex gap-4 items-center">
                            <input type="text" id="newPlayerName" class="form-control" placeholder="Player Name" required>
                            <input type="number" id="newPlayerRating" class="form-control" placeholder="Rating" value="${t.default_rating}" required style="width: 120px;">
                            <button type="submit" class="btn btn-primary" style="white-space: nowrap;">Add Player</button>
                        </form>
                    </div>`;
                }
                
                html += `<div class="card table-container"><table>
                    <thead><tr><th>Name</th><th>Rating</th><th>Status</th>${window.isAdmin ? '<th>Action</th>' : ''}</tr></thead><tbody>`;
                players.forEach(p => {
                    let statusBadge = p.active ? '<span class="badge badge-active" style="background:#10b981; color:white;">Active</span>' : '<span class="badge" style="background:#ef4444; color:white;">Inactive</span>';
                    html += `<tr>
                        <td style="font-weight: 500; color: white;">${p.name}</td>
                        <td>${p.rating}</td>
                        <td>${statusBadge}</td>
                        ${window.isAdmin ? `<td>
                            <div class="flex gap-2">
                                <button class="btn btn-outline btn-sm edit-player-btn" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" data-rating="${p.rating}" data-active="${p.active}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Edit</button>
                                <button class="btn btn-outline btn-sm delete-player-btn" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" style="padding: 0.2rem 0.5rem; font-size: 0.8rem; color: #ef4444; border-color: #ef4444;">Delete</button>
                            </div>
                        </td>` : ''}
                    </tr>`;
                });
                if (players.length === 0) html += `<tr><td colspan="${window.isAdmin ? 4 : 3}" class="text-center text-muted">No players added yet</td></tr>`;
                html += `</tbody></table></div>`;
            }

            appRoot.innerHTML = html;

            // Bind events
            document.querySelectorAll('.tab[data-tab]').forEach(el => {
                el.addEventListener('click', (e) => {
                    activeTab = e.target.dataset.tab;
                    render();
                });
            });

            document.querySelectorAll('.tab[data-round]').forEach(el => {
                el.addEventListener('click', (e) => {
                    activeRound = parseInt(e.target.dataset.round);
                    render();
                });
            });

            const addPlayerForm = document.getElementById('addPlayerForm');
            if (addPlayerForm) {
                addPlayerForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await fetch('api/players.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            tournament_id: t.id,
                            name: document.getElementById('newPlayerName').value,
                            rating: document.getElementById('newPlayerRating').value
                        })
                    });
                    renderTournamentDetail(id, 'players'); // reload and stay on players tab
                });
            }

            document.querySelectorAll('.edit-player-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const pid = e.target.dataset.id;
                    const oldName = e.target.dataset.name;
                    const oldRating = e.target.dataset.rating;
                    const oldActive = e.target.dataset.active == "1";

                    const tr = e.target.closest('tr');
                    
                    tr.innerHTML = `
                        <td><input type="text" class="form-control edit-name-input" value="${oldName.replace(/"/g, '&quot;')}" style="padding:0.3rem;"></td>
                        <td><input type="number" class="form-control edit-rating-input" value="${oldRating}" style="padding:0.3rem; width: 90px;"></td>
                        <td>
                            <select class="form-control edit-active-select" style="padding:0.3rem; width: 100px;">
                                <option value="1" ${oldActive ? 'selected' : ''}>Active</option>
                                <option value="0" ${!oldActive ? 'selected' : ''}>Inactive</option>
                            </select>
                        </td>
                        <td>
                            <div class="flex gap-2">
                                <button class="btn btn-success btn-sm save-player-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Save</button>
                                <button class="btn btn-outline btn-sm discard-player-btn" style="padding: 0.2rem 0.5rem; font-size: 0.8rem;">Discard</button>
                            </div>
                        </td>
                    `;

                    tr.querySelector('.discard-player-btn').addEventListener('click', () => {
                        renderTournamentDetail(id, 'players'); // Re-render to revert
                    });

                    tr.querySelector('.save-player-btn').addEventListener('click', async () => {
                        const newName = tr.querySelector('.edit-name-input').value.trim();
                        const newRating = parseInt(tr.querySelector('.edit-rating-input').value) || 1200;
                        const newActive = parseInt(tr.querySelector('.edit-active-select').value);

                        if (!newName) {
                            alert('Name cannot be empty');
                            return;
                        }

                        const saveBtn = tr.querySelector('.save-player-btn');
                        saveBtn.disabled = true;
                        saveBtn.textContent = '...';

                        await fetch('api/players.php', {
                            method: 'PUT',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({
                                id: pid,
                                name: newName,
                                rating: newRating,
                                active: newActive
                            })
                        });
                        renderTournamentDetail(id, 'players');
                    });
                });
            });

            document.querySelectorAll('.delete-player-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const pid = e.target.dataset.id;
                    const pName = e.target.dataset.name;
                    if (!confirm(`Are you sure you want to completely delete player "${pName}"?\nWARNING: This will also delete their match history!`)) return;

                    await fetch(`api/players.php?id=${pid}`, {
                        method: 'DELETE'
                    });
                    renderTournamentDetail(id, 'players');
                });
            });
            
            const btnGenerateRound = document.getElementById('btnGenerateRound');
            if (btnGenerateRound) {
                btnGenerateRound.addEventListener('click', async () => {
                    btnGenerateRound.disabled = true;
                    btnGenerateRound.textContent = 'Generating...';
                    const res = await fetch('api/rounds.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            action: 'generate',
                            tournament_id: t.id
                        })
                    });
                    if (res.ok) {
                        renderTournamentDetail(id, 'rounds');
                    } else {
                        const err = await res.json();
                        alert('Error generating round: ' + err.error);
                        btnGenerateRound.disabled = false;
                        btnGenerateRound.textContent = 'Generate Next Round';
                    }
                });
            }
            
            document.querySelectorAll('.result-select').forEach(sel => {
                sel.addEventListener('change', async (e) => {
                    const pairingId = e.target.dataset.pairing;
                    const result = e.target.value;
                    if (!result) return;
                    await fetch('api/pairings.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            pairing_id: pairingId,
                            result: result
                        })
                    });
                });
            });
            
            const btnCompleteRound = document.getElementById('btnCompleteRound');
            if (btnCompleteRound) {
                btnCompleteRound.addEventListener('click', async () => {
                    if (!confirm('Are you sure you want to complete this round? Make sure all results are entered.')) return;
                    const roundId = btnCompleteRound.dataset.round;
                    await fetch('api/rounds.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            action: 'complete',
                            tournament_id: t.id,
                            round_id: roundId
                        })
                    });
                    renderTournamentDetail(id, 'rounds', activeRound);
                });
            }
        }
        
        render();
    }

    // Initialize router
    window.addEventListener('hashchange', navigate);
    navigate();
});
