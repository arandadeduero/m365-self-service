/**
 * Org chart page: draws the tree and runs the search box.
 * The people come from the JSON block the server writes into the page.
 */
(function () {
  const dataElement = document.getElementById('orgChartData');
  if (!dataElement) return;
  const { nodes, unplaced, currentUserId } = JSON.parse(dataElement.textContent);

  const escapeHtml = (text) => String(text == null ? '' : text).replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));

  // Ignore case and accents, so "garcia" finds "García"
  const normalize = (text) => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('');

  // The same department always gets the same color, so areas can be told apart at a glance
  const departmentColor = (department) => {
    if (!department) return '#5a6678';
    let hash = 0;
    for (const char of department) hash = (hash * 31 + char.codePointAt(0)) % 360;
    return `hsl(${hash} 55% 36%)`;
  };

  // ------------------------------------------------------------------ chart

  const container = document.getElementById('orgChart');
  let chart = null;

  const peopleBelow = (count) => (count === 1 ? '1 persona a su cargo' : `${count} personas a su cargo`);

  const card = (d) => {
    const person = d.data;
    const classes = ['org-card'];
    if (person.virtual) classes.push('is-org');
    if (person.id === currentUserId) classes.push('is-me');
    if (person._highlighted) classes.push('is-found');
    const color = departmentColor(person.department);
    const chat = person.mail
      ? `<a class="org-chat" href="https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(person.mail)}" target="_blank" rel="noopener">Chat</a>`
      : '';

    return `
      <div class="${classes.join(' ')}" style="height:${d.height}px;border-left-color:${color}">
        <div class="org-card-main">
          ${person.virtual ? '' : `<span class="org-avatar" style="background:${color}">${escapeHtml(initials(person.name))}</span>`}
          <div class="org-card-text">
            <div class="org-name" title="${escapeHtml(person.name)}">${escapeHtml(person.name)}${person.id === currentUserId ? ' <span class="org-me">Tú</span>' : ''}</div>
            ${person.jobTitle ? `<div class="org-job" title="${escapeHtml(person.jobTitle)}">${escapeHtml(person.jobTitle)}</div>` : ''}
            ${person.department ? `<div class="org-department">${escapeHtml(person.department)}</div>` : ''}
          </div>
        </div>
        <div class="org-card-foot">
          <span>${person._totalSubordinates ? peopleBelow(person._totalSubordinates) : ''}</span>
          ${chat}
        </div>
      </div>`;
  };

  // The library only marks nodes (expanded, highlighted, centered); nothing
  // moves on screen until render() is called.
  const showPerson = (id) => {
    chart.clearHighlighting();
    // Seen whole, the chart is too small to read: go back to full size first
    const state = chart.getChartState();
    if (state.lastTransform.k < 1) state.svg.call(state.zoomBehavior.scaleTo, 1);
    chart.setHighlighted(id).render();
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  if (container) {
    const failed = document.getElementById('orgChartFailed');
    try {
      chart = new d3.OrgChart()
        .container('#orgChart')
        .data(nodes)
        .nodeId((d) => d.id)
        .parentNodeId((d) => d.parentId)
        .svgHeight(container.clientHeight)
        .nodeWidth(() => 280)
        .nodeHeight(() => 134)
        .childrenMargin(() => 56)
        .siblingsMargin(() => 24)
        .compactMarginBetween(() => 24)
        .compactMarginPair(() => 40)
        .initialExpandLevel(1)
        // The card shows who was found; the library's own thick outline is not needed
        .nodeUpdate(function () {})
        .linkUpdate(function () {
          d3.select(this).attr('stroke', '#9fb0c5').attr('stroke-width', 1.5);
        })
        .buttonContent(({ node }) => `<div class="org-toggle">${node.children ? '−' : '+'} ${node.data._directSubordinates}</div>`)
        .nodeContent(card)
        .render()
        .fit();
    } catch (error) {
      console.error('Could not draw the org chart:', error);
      chart = null;
      container.classList.add('d-none');
      document.getElementById('orgToolbar').classList.add('d-none');
      failed.classList.remove('d-none');
    }
  }

  const inChart = new Set(chart ? nodes.map((node) => node.id) : []);

  if (chart) {
    const actions = {
      me: () => showPerson(currentUserId),
      expand: () => chart.expandAll().fit(),
      // Back to how the page opens: the top and the people right below
      collapse: () => {
        chart.collapseAll();
        nodes.filter((node) => node.parentId === nodes[0].id).forEach((node) => chart.setExpanded(node.id));
        chart.render().fit();
      },
      fit: () => chart.fit(),
      'zoom-in': () => chart.zoomIn(),
      'zoom-out': () => chart.zoomOut(),
    };
    document.querySelectorAll('[data-org-action]').forEach((button) => {
      button.addEventListener('click', () => actions[button.dataset.orgAction]());
    });
    if (inChart.has(currentUserId)) {
      document.querySelector('[data-org-action="me"]').classList.remove('d-none');
    }
  }

  // ----------------------------------------------------------------- search

  const MAX_RESULTS = 12;
  const input = document.getElementById('orgSearch');
  const list = document.getElementById('orgSearchResults');
  const unplacedBox = document.getElementById('orgUnplaced');

  const people = [...nodes.filter((node) => !node.virtual), ...unplaced].map((person) => ({
    person,
    name: normalize(person.name),
    text: normalize([person.name, person.jobTitle, person.department, person.mail].join(' ')),
  }));

  let matches = [];
  let active = -1;

  const close = () => {
    list.classList.add('d-none');
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    matches = [];
    active = -1;
  };

  const setActive = (index) => {
    active = index;
    list.querySelectorAll('[role="option"]').forEach((option, position) => {
      option.classList.toggle('active', position === index);
      option.setAttribute('aria-selected', position === index ? 'true' : 'false');
      if (position === index) {
        input.setAttribute('aria-activedescendant', option.id);
        option.scrollIntoView({ block: 'nearest' });
      }
    });
  };

  const showUnplaced = (id) => {
    const row = Array.from(unplacedBox.querySelectorAll('tr[data-person-id]')).find((tr) => tr.dataset.personId === id);
    if (!row) return;
    unplacedBox.open = true;
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.remove('org-row-found');
    void row.offsetWidth; // restarts the animation when the same row is found twice
    row.classList.add('org-row-found');
  };

  const choose = (person) => {
    close();
    input.value = person.name;
    if (inChart.has(person.id)) showPerson(person.id);
    else if (unplacedBox) showUnplaced(person.id);
  };

  const note = (text) => {
    const item = document.createElement('div');
    item.className = 'list-group-item text-muted small';
    item.textContent = text;
    return item;
  };

  const search = () => {
    const words = normalize(input.value).split(/\s+/).filter(Boolean);
    close();
    if (words.join('').length < 2) return;

    const found = people.filter((entry) => words.every((word) => entry.text.includes(word)));
    // People whose name starts with what was typed go first
    const startsWith = (entry) => (entry.name.startsWith(words[0]) ? 0 : 1);
    found.sort((a, b) => startsWith(a) - startsWith(b) || a.name.localeCompare(b.name));
    matches = found.slice(0, MAX_RESULTS).map((entry) => entry.person);

    matches.forEach((person, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `orgSearchOption${index}`;
      option.className = 'list-group-item list-group-item-action';
      option.setAttribute('role', 'option');
      const name = document.createElement('div');
      name.className = 'fw-semibold';
      name.textContent = person.name;
      const detail = document.createElement('div');
      detail.className = 'small org-result-detail';
      detail.textContent = [person.jobTitle, person.department].filter(Boolean).join(' · ')
        || (inChart.has(person.id) ? '' : 'Fuera del organigrama');
      option.append(name, detail);
      // mousedown, not click: it comes before the input loses the focus
      option.addEventListener('mousedown', (event) => {
        event.preventDefault();
        choose(person);
      });
      list.appendChild(option);
    });

    if (found.length === 0) list.appendChild(note('Nadie coincide con la búsqueda.'));
    if (found.length > MAX_RESULTS) list.appendChild(note(`Y ${found.length - MAX_RESULTS} más: escribe algo más para afinar.`));

    list.classList.remove('d-none');
    input.setAttribute('aria-expanded', 'true');
  };

  input.addEventListener('input', search);
  input.addEventListener('focus', () => { if (input.value) search(); });
  input.addEventListener('blur', close);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown' && matches.length > 0) {
      event.preventDefault();
      setActive((active + 1) % matches.length);
    } else if (event.key === 'ArrowUp' && matches.length > 0) {
      event.preventDefault();
      setActive((active - 1 + matches.length) % matches.length);
    } else if (event.key === 'Enter' && matches.length > 0) {
      event.preventDefault();
      choose(matches[Math.max(active, 0)]);
    }
  });
})();
