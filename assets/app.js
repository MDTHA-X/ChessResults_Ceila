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

        function getFideDp(p) {
            if (p >= 1.0) return 800;
            if (p <= 0.0) return -800;
            return Math.round(-400 * Math.log(1/p - 1) / Math.LN10);
        }

        function showPlayerDetails(pId) {
            pId = parseInt(pId);
            const pl = players.find(x => x.id === pId);
            if (!pl) return;
            const st = standings.find(x => x.player_id === pId);
            const rank = standings.findIndex(x => x.player_id === pId) + 1;
            
            let games = [];
            rounds.filter(r => r.status === 'completed' || r.status === 'draft').forEach(r => {
                r.pairings.forEach(p => {
                    if (p.white_id === pId || p.black_id === pId || p.bye_for_id === pId) {
                        games.push({ round: r, pairing: p });
                    }
                });
            });

            let oppRatingsSum = 0;
            let oppCount = 0;
            let pointsScored = 0;
            let gamesHtml = `<div class="table-container" style="margin-top: 1rem;"><table>
                <thead><tr><th>Rd.</th><th>Bo.</th><th>SNo</th><th>Name</th><th>Rtg</th><th>Batch</th><th>Pts.</th><th>Res.</th></tr></thead>
                <tbody>`;

            games.forEach(g => {
                const isWhite = g.pairing.white_id === pId;
                const isBye = g.pairing.is_bye;
                let oppId = isWhite ? g.pairing.black_id : g.pairing.white_id;
                let opp = players.find(x => x.id === oppId);
                let oppSt = standings.find(x => x.player_id === oppId);
                
                let sNo = isBye ? '-' : (playerSeeds[oppId] || '-');
                let oppName = isBye ? 'BYE' : (opp ? opp.name : '-');
                let oppRtg = isBye ? '-' : (opp ? opp.rating : '-');
                let oppBatch = isBye ? '-' : (opp ? (opp.batch || '-') : '-');
                let oppPts = isBye ? '-' : (oppSt ? oppSt.points : 0);
                
                let resStr = '-';
                if (g.round.status === 'completed' || g.pairing.result) {
                    if (isBye) {
                        pointsScored += 1;
                        resStr = '1';
                    } else if (g.pairing.result === '1-0') {
                        if (isWhite) { pointsScored += 1; resStr = '1'; } else { resStr = '0'; }
                    } else if (g.pairing.result === '0-1') {
                        if (!isWhite) { pointsScored += 1; resStr = '1'; } else { resStr = '0'; }
                    } else if (g.pairing.result === '1/2') {
                        pointsScored += 0.5;
                        resStr = '½';
                    }
                }
                
                if (!isBye && oppRtg !== '-') {
                    oppRatingsSum += parseInt(oppRtg);
                    oppCount++;
                }

                gamesHtml += `<tr>
                    <td>${g.round.number}</td>
                    <td>${g.pairing.board}</td>
                    <td>${sNo}</td>
                    <td><a href="#" class="player-link" data-id="${oppId}" style="color: var(--primary); text-decoration: none;">${oppName}</a></td>
                    <td>${oppRtg}</td>
                    <td>${oppBatch}</td>
                    <td>${oppPts}</td>
                    <td style="font-weight: bold;">${resStr}</td>
                </tr>`;
            });
            gamesHtml += `</tbody></table></div>`;

            let Ra = oppCount > 0 ? Math.round(oppRatingsSum / oppCount) : 0;
            let Rp = 0;
            if (oppCount > 0) {
                let p = pointsScored / oppCount;
                let dp = getFideDp(p);
                Rp = Ra + dp;
            }

            let html = `
                <h2 style="margin-bottom: 1rem; border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; margin-top: 0;">Player info</h2>
                <div style="display: grid; grid-template-columns: 150px 1fr; gap: 0.5rem; line-height: 1.6; margin-bottom: 1rem; text-align: left;">
                    <div style="color: var(--text-muted);">Name</div><div style="font-weight: 500;">${pl.name}</div>
                    <div style="color: var(--text-muted);">Title</div><div>${pl.title || '-'}</div>
                    <div style="color: var(--text-muted);">Sex</div><div>${pl.sex || '-'}</div>
                    <div style="color: var(--text-muted);">Batch</div><div>${pl.batch || '-'}</div>
                    <div style="color: var(--text-muted);">Starting rank</div><div>${playerSeeds[pId]}</div>
                    <div style="color: var(--text-muted);">Rating</div><div>${pl.rating}</div>
                    <div style="color: var(--text-muted);">Performance</div><div>${oppCount > 0 ? Rp : '-'}</div>
                    <div style="color: var(--text-muted);">Points</div><div>${st ? st.points : 0}</div>
                    <div style="color: var(--text-muted);">Rank</div><div>${rank}</div>
                </div>
                ${gamesHtml}
            `;
            
            document.getElementById('playerModalBody').innerHTML = html;
            
            // Rebind player links inside the modal!
            document.getElementById('playerModalBody').querySelectorAll('.player-link').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (e.target.dataset.id && e.target.dataset.id !== 'undefined') {
                        showPlayerDetails(e.target.dataset.id);
                    }
                });
            });

            document.getElementById('playerModal').style.display = 'block';
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
                        <th>Rk</th><th>SNo</th><th>Name</th><th>Rating</th><th>Pts</th><th>BH-1</th><th>BH</th>
                    </tr></thead><tbody>`;
                standings.forEach((st, i) => {
                    html += `<tr>
                        <td>${i + 1}</td>
                        <td>${playerSeeds[st.player_id]}</td>
                        <td><a href="#" class="player-link" data-id="${st.player_id}" style="color: var(--primary); text-decoration: none;">${st.name}</a></td>
                        <td>${st.rating}</td>
                        <td style="font-weight: bold;">${st.points}</td>
                        <td>${st.buchholz_cut1}</td>
                        <td>${st.buchholz}</td>
                    </tr>`;
                });
                if (standings.length === 0) html += `<tr><td colspan="7" class="text-center text-muted">No standings available yet</td></tr>`;
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
                        let wName = p.is_bye ? '' : formatPlayerName(p.white_id);
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
                        html += `<div class="flex" style="justify-content: flex-end; margin-top: -1rem; margin-bottom: 2rem; gap: 1rem;">`;
                        if (r.number > 1) {
                            html += `<button class="btn btn-outline btn-discard-round" style="border-color: #ef4444; color: #ef4444;" data-round="${r.id}">Discard Round</button>`;
                        }
                        html += `<button class="btn btn-success btn-complete-round" data-round="${r.id}">Complete Round ${r.number}</button>
                        </div>`;
                    } else if (r.status === 'completed' && window.isAdmin && r.number === rounds[rounds.length - 1].number) {
                        html += `<div class="flex" style="justify-content: flex-end; margin-top: -1rem; margin-bottom: 2rem;">
                            <button class="btn btn-outline btn-reopen-round" data-round="${r.id}">Reopen Round to Edit Results</button>
                        </div>`;
                    }
                } else {
                    html += `<div class="card"><div class="text-center text-muted" style="padding: 2rem 0;">No rounds generated yet.</div></div>`;
                }
            } else if (activeTab === 'players') {
                if (window.isAdmin) {
                    html += `<div class="card mb-4">
                        <h3 class="mb-4">Add Player</h3>
                        <form id="addPlayerForm" class="flex gap-2 items-center" style="flex-wrap: wrap;">
                            <input type="text" id="playerName" class="form-control" placeholder="Player Name" required style="flex: 1; min-width: 200px;">
                            <select id="playerTitle" class="form-control" style="width: 80px;">
                                <option value="">Title</option>
                                <option value="GM">GM</option>
                                <option value="IM">IM</option>
                                <option value="FM">FM</option>
                                <option value="CM">CM</option>
                                <option value="WGM">WGM</option>
                                <option value="WIM">WIM</option>
                                <option value="WFM">WFM</option>
                                <option value="WCM">WCM</option>
                            </select>
                            <select id="playerSex" class="form-control" style="width: 80px;">
                                <option value="">Sex</option>
                                <option value="M">M</option>
                                <option value="F">F</option>
                            </select>
                            <input type="text" id="playerBatch" class="form-control" placeholder="Batch" style="width: 100px;">
                            <input type="number" id="playerRating" class="form-control" placeholder="Rating" value="1200" required style="width: 100px;">
                            <button type="submit" class="btn btn-primary">Add Player</button>
                        </form>
                    </div>`;
                }
                html += `<div class="card table-container"><table>
                    <thead><tr><th>Name</th><th>Title</th><th>Sex</th><th>Batch</th><th>Rating</th><th>Active</th>${window.isAdmin ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody>`;
                players.forEach(p => {
                    if (editingPlayerId === p.id) {
                        html += `<tr>
                            <td><input type="text" id="editName_${p.id}" class="form-control" value="${p.name}" style="width: 100%;"></td>
                            <td>
                                <select id="editTitle_${p.id}" class="form-control">
                                    <option value="" ${p.title === '' ? 'selected' : ''}></option>
                                    <option value="GM" ${p.title === 'GM' ? 'selected' : ''}>GM</option>
                                    <option value="IM" ${p.title === 'IM' ? 'selected' : ''}>IM</option>
                                    <option value="FM" ${p.title === 'FM' ? 'selected' : ''}>FM</option>
                                    <option value="CM" ${p.title === 'CM' ? 'selected' : ''}>CM</option>
                                    <option value="WGM" ${p.title === 'WGM' ? 'selected' : ''}>WGM</option>
                                    <option value="WIM" ${p.title === 'WIM' ? 'selected' : ''}>WIM</option>
                                    <option value="WFM" ${p.title === 'WFM' ? 'selected' : ''}>WFM</option>
                                    <option value="WCM" ${p.title === 'WCM' ? 'selected' : ''}>WCM</option>
                                </select>
                            </td>
                            <td>
                                <select id="editSex_${p.id}" class="form-control">
                                    <option value="" ${p.sex === '' ? 'selected' : ''}></option>
                                    <option value="M" ${p.sex === 'M' ? 'selected' : ''}>M</option>
                                    <option value="F" ${p.sex === 'F' ? 'selected' : ''}>F</option>
                                </select>
                            </td>
                            <td><input type="text" id="editBatch_${p.id}" class="form-control" value="${p.batch || ''}" style="width: 80px;"></td>
                            <td><input type="number" id="editRating_${p.id}" class="form-control" value="${p.rating}" style="width: 80px;"></td>
                            <td>
                                <select id="editActive_${p.id}" class="form-control">
                                    <option value="1" ${p.active ? 'selected' : ''}>Yes</option>
                                    <option value="0" ${!p.active ? 'selected' : ''}>No</option>
                                </select>
                            </td>
                            <td>
                                <button class="btn btn-success btn-sm btn-save-player" data-id="${p.id}" style="margin-right: 0.5rem;">Save</button>
                                <button class="btn btn-outline btn-sm btn-cancel-edit">Discard</button>
                            </td>
                        </tr>`;
                    } else {
                        html += `<tr class="${!p.active ? 'text-muted' : ''}">
                            <td><a href="#" class="player-link" data-id="${p.id}" style="color: var(--primary); text-decoration: none;">${p.name}</a></td>
                            <td>${p.title || ''}</td>
                            <td>${p.sex || ''}</td>
                            <td>${p.batch || ''}</td>
                            <td>${p.rating}</td>
                            <td>${p.active ? 'Yes' : 'No'}</td>
                            ${window.isAdmin ? `<td>
                                <button class="btn btn-outline btn-sm btn-edit-player" data-id="${p.id}" style="margin-right: 0.5rem;">Edit</button>
                                <button class="btn btn-outline btn-sm btn-delete-player" style="border-color: #ef4444; color: #ef4444;" data-id="${p.id}">Delete</button>
                            </td>` : ''}
                        </tr>`;
                    }
                });
                if (players.length === 0) html += `<tr><td colspan="7" class="text-center text-muted">No players added yet</td></tr>`;
                html += `</tbody></table></div>`;
            }
            
            html += `<div id="playerModal" class="modal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.5);">
                <div class="modal-content card" style="margin: 5% auto; padding: 20px; width: 80%; max-width: 800px; position: relative;">
                    <span class="close-modal" style="position: absolute; right: 20px; top: 15px; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                    <div id="playerModalBody"></div>
                </div>
            </div>`;

            appRoot.innerHTML = html;

            document.querySelectorAll('.player-link').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    showPlayerDetails(e.target.dataset.id);
                });
            });
            
            const modal = document.getElementById('playerModal');
            if (modal) {
                modal.querySelector('.close-modal').addEventListener('click', () => {
                    modal.style.display = 'none';
                });
                window.addEventListener('click', (e) => {
                    if (e.target == modal) {
                        modal.style.display = 'none';
                    }
                });
            }

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
                            name: document.getElementById('playerName').value,
                            title: document.getElementById('playerTitle').value,
                            sex: document.getElementById('playerSex').value,
                            batch: document.getElementById('playerBatch').value,
                            rating: document.getElementById('playerRating').value
                        })
                    });
                    renderTournamentDetail(id, 'players');
                });
            }

            document.querySelectorAll('.btn-edit-player').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    editingPlayerId = parseInt(e.target.dataset.id);
                    render();
                });
            });

            document.querySelectorAll('.btn-cancel-edit').forEach(btn => {
                btn.addEventListener('click', () => {
                    editingPlayerId = null;
                    render();
                });
            });

            document.querySelectorAll('.btn-save-player').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const pId = e.target.dataset.id;
                    const newName = document.getElementById(`editName_${pId}`).value.trim();
                    if (!newName) {
                        alert('Name cannot be empty');
                        return;
                    }
                    await fetch('api/players.php', {
                        method: 'PUT',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            id: pId,
                            name: newName,
                            title: document.getElementById(`editTitle_${pId}`).value,
                            sex: document.getElementById(`editSex_${pId}`).value,
                            batch: document.getElementById(`editBatch_${pId}`).value,
                            rating: document.getElementById(`editRating_${pId}`).value,
                            active: document.getElementById(`editActive_${pId}`).value
                        })
                    });
                    editingPlayerId = null;
                    renderTournamentDetail(id, 'players');
                });
            });

            document.querySelectorAll('.btn-delete-player').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const pid = e.target.dataset.id;
                    if (!confirm(`Are you sure you want to completely delete this player?\nWARNING: This will also delete their match history!`)) return;

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
            
            document.querySelectorAll('.btn-complete-round').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (!confirm('Are you sure you want to complete this round? Make sure all results are entered.')) return;
                    const roundId = e.target.dataset.round;
                    await fetch('api/rounds.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'complete', tournament_id: t.id, round_id: roundId })
                    });
                    renderTournamentDetail(id, 'rounds', activeRound);
                });
            });

            document.querySelectorAll('.btn-discard-round').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (!confirm('Are you sure you want to discard this round? All pairings will be deleted.')) return;
                    const roundId = e.target.dataset.round;
                    await fetch('api/rounds.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'delete', tournament_id: t.id, round_id: roundId })
                    });
                    renderTournamentDetail(id, 'rounds', activeRound - 1 > 0 ? activeRound - 1 : null);
                });
            });

            document.querySelectorAll('.btn-reopen-round').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if (!confirm('Are you sure you want to reopen this round? You will need to complete it again before generating the next round.')) return;
                    const roundId = e.target.dataset.round;
                    await fetch('api/rounds.php', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ action: 'reopen', tournament_id: t.id, round_id: roundId })
                    });
                    renderTournamentDetail(id, 'rounds', activeRound);
                });
            });
        }
        
        render();
    }

    // Initialize router
    window.addEventListener('hashchange', navigate);
    navigate();
});
