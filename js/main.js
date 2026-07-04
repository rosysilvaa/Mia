(function(){
  // ---------- ESTADO ----------
  const CATEGORY_LABEL = { eu:'Eu', familia:'Família', trabalho:'Trabalho' };
  const STORAGE_KEY = 'mia.tasks';
  const CHAT_PENDING_KEY = 'mia.pendingChatMessage';
  const todayISO = () => new Date().toISOString().slice(0,10);

  const toISO = (d) => {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off*60000);
    return local.toISOString().slice(0,10);
  };
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return toISO(d); };

  const defaultTasks = [
    { id:1, title:'Reunião com a coordenação', category:'trabalho', date:todayISO(), time:'09:30', place:'Escritório' },
    { id:2, title:'Escola — reunião de pais', category:'familia', date:addDays(1), time:'14:00', place:'Colégio do Ana' },
    { id:3, title:'Consulta médica', category:'eu', date:addDays(2), time:'10:15', place:'Clínica Bem Estar' },
    { id:4, title:'Aniversário da tia Rosa', category:'familia', date:addDays(4), time:'19:00', place:'Casa da tia Rosa' },
    { id:5, title:'Entrega do relatório mensal', category:'trabalho', date:addDays(5), time:'18:00', place:'Online' },
    { id:6, title:'Ioga — 30 minutos pra mim', category:'eu', date:addDays(6), time:'07:00', place:'Em casa' },
  ];
  function loadTasks(){
    try{
      const saved = localStorage.getItem(STORAGE_KEY);
      if(!saved) return [...defaultTasks];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [...defaultTasks];
    } catch {
      return [...defaultTasks];
    }
  }
  function saveTasks(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  let tasks = loadTasks();
  if(!localStorage.getItem(STORAGE_KEY)) saveTasks();
  let nextId = tasks.reduce((max, task)=> Math.max(max, Number(task.id) || 0), 0) + 1;
  let showingAll = false;
  let selectedCat = 'eu';
  let calCursor = new Date();
  let selectedDay = todayISO();

  // ---------- DATA NO HEADER ----------
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const diasSemana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  function renderTodayPill(){
    const pill = document.getElementById('today-pill');
    if(!pill) return;
    const d = new Date();
    pill.textContent = `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
  }

  function fmtDay(iso){
    const [y,m,d] = iso.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    return { num: d, mes: meses[m-1].slice(0,3) };
  }

  // ---------- TASK LIST (HOME) ----------
  function sortedTasks(){
    return [...tasks].sort((a,b)=> (a.date+a.time).localeCompare(b.date+b.time));
  }

  function renderTaskList(){
    const list = document.getElementById('task-list');
    if(!list) return;
    list.innerHTML = '';
    const ordered = sortedTasks();
    const taskCount = document.getElementById('task-count');
    if(taskCount) taskCount.textContent = `${ordered.length} no total`;
    ordered.forEach((t, i)=>{
      const card = document.createElement('div');
      card.className = `task-card ${t.category}` + (i>=3 ? ' hidden-task' : '');
      if (i>=3 && showingAll) card.classList.add('show');
      const { num, mes } = fmtDay(t.date);
      card.innerHTML = `
        <div class="task-time"><span class="day">${num}</span><span>${mes}</span></div>
        <div class="task-info">
          <h3>${t.title}</h3>
          <p>${t.time} · ${t.place || ''}</p>
        </div>
        <span class="badge ${t.category}">${CATEGORY_LABEL[t.category]}</span>
      `;
      list.appendChild(card);
    });
    const verMaisBtn = document.getElementById('ver-mais-btn');
    if(verMaisBtn){
      verMaisBtn.style.display = ordered.length > 3 ? 'block' : 'none';
      verMaisBtn.textContent = showingAll ? 'Ver menos' : 'Ver mais';
    }
  }

  const verMaisBtn = document.getElementById('ver-mais-btn');
  if(verMaisBtn){
    verMaisBtn.addEventListener('click', ()=>{
      showingAll = !showingAll;
      renderTaskList();
    });
  }

  // ---------- MODAL: NOVA TAREFA ----------
  const overlayAdd = document.getElementById('overlay-add');
  const addTaskBtnInline = document.getElementById('btn-add-task-inline');
  if(overlayAdd && addTaskBtnInline){
    addTaskBtnInline.addEventListener('click', ()=>{
      const newDate = document.getElementById('new-date');
      if(newDate) newDate.value = todayISO();
      overlayAdd.classList.add('open');
    });
    const cancelAdd = document.getElementById('cancel-add');
    if(cancelAdd) cancelAdd.addEventListener('click', ()=> overlayAdd.classList.remove('open'));
    overlayAdd.addEventListener('click', (e)=>{ if(e.target === overlayAdd) overlayAdd.classList.remove('open'); });

    document.querySelectorAll('.cat-opt').forEach(opt=>{
      opt.addEventListener('click', ()=>{
        document.querySelectorAll('.cat-opt').forEach(o=>o.classList.remove('active'));
        opt.classList.add('active');
        selectedCat = opt.dataset.cat;
      });
    });

    const confirmAdd = document.getElementById('confirm-add');
    if(confirmAdd){
      confirmAdd.addEventListener('click', ()=>{
        const titleInput = document.getElementById('new-title');
        const dateInput = document.getElementById('new-date');
        const timeInput = document.getElementById('new-time');
        const title = titleInput ? titleInput.value.trim() : '';
        const date = dateInput && dateInput.value ? dateInput.value : todayISO();
        const time = timeInput && timeInput.value ? timeInput.value : '09:00';
        if(!title){ if(titleInput) titleInput.focus(); return; }
        tasks.push({ id:nextId++, title, category:selectedCat, date, time, place:'' });
        saveTasks();
        if(titleInput) titleInput.value = '';
        overlayAdd.classList.remove('open');
        renderTaskList();
        renderCalendar();
        renderDayDetail(selectedDay);
      });
    }
  }

  // ---------- MODAL: EMERGÊNCIA ----------
  const overlayEmg = document.getElementById('overlay-emergency');
  function openEmergency(){ overlayEmg.classList.add('open'); }
  if(overlayEmg){
    const emergencyButtons = ['btn-emergency', 'btn-emergency-2'];
    emergencyButtons.forEach((buttonId)=>{
      const button = document.getElementById(buttonId);
      if(button) button.addEventListener('click', openEmergency);
    });
    const closeEmergency = document.getElementById('close-emergency');
    if(closeEmergency) closeEmergency.addEventListener('click', ()=> overlayEmg.classList.remove('open'));
    overlayEmg.addEventListener('click', (e)=>{ if(e.target === overlayEmg) overlayEmg.classList.remove('open'); });
    const emgContact = document.getElementById('emg-contact');
    if(emgContact){
      emgContact.addEventListener('click', ()=>{
        alert('Em um app completo, isso ligaria diretamente para o seu contato de confiança salvo.');
      });
    }
  }

  // ---------- CALENDÁRIO ----------
  function renderCalendar(){
    const label = document.getElementById('cal-month-label');
    const grid = document.getElementById('cal-days');
    if(!label || !grid) return;
    label.textContent = `${meses[calCursor.getMonth()]} de ${calCursor.getFullYear()}`;
    grid.innerHTML = '';
    const year = calCursor.getFullYear(), month = calCursor.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    const tasksByDate = {};
    tasks.forEach(t=>{ (tasksByDate[t.date] ||= []).push(t); });

    for(let i=0;i<firstDow;i++){
      const empty = document.createElement('div');
      empty.className = 'cal-day empty';
      grid.appendChild(empty);
    }
    for(let d=1; d<=daysInMonth; d++){
      const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div');
      cell.className = 'cal-day';
      if(iso === todayISO()) cell.classList.add('today');
      if(iso === selectedDay && iso !== todayISO()) cell.classList.add('selected');
      const cats = [...new Set((tasksByDate[iso]||[]).map(t=>t.category))];
      cell.innerHTML = `<span>${d}</span><div class="cal-dots">${cats.map(c=>`<span style="background:var(--${c})"></span>`).join('')}</div>`;
      cell.addEventListener('click', ()=>{ selectedDay = iso; renderCalendar(); renderDayDetail(iso); });
      grid.appendChild(cell);
    }
  }

  function renderDayDetail(iso){
    const title = document.getElementById('day-detail-title');
    const list = document.getElementById('day-detail-list');
    if(!title || !list) return;
    const { num, mes } = fmtDay(iso);
    const isToday = iso === todayISO();
    title.textContent = isToday ? 'Hoje' : `${num} de ${mes}`;
    const dayTasks = tasks.filter(t=>t.date===iso).sort((a,b)=>a.time.localeCompare(b.time));
    list.innerHTML = dayTasks.length ? '' : `<p style="color:var(--ink-soft); font-size:13px;">Nenhum compromisso neste dia. Um respiro pra você. 🌿</p>`;
    dayTasks.forEach(t=>{
      const card = document.createElement('div');
      card.className = `task-card ${t.category}`;
      card.innerHTML = `
        <div class="task-time"><span class="day">${t.time.split(':')[0]}h</span><span>${t.time.split(':')[1]}</span></div>
        <div class="task-info"><h3>${t.title}</h3><p>${t.place || ''}</p></div>
        <span class="badge ${t.category}">${CATEGORY_LABEL[t.category]}</span>
      `;
      list.appendChild(card);
    });
  }

  // ---------- INICIALIZAÇÃO ----------
  renderTodayPill();
  renderTaskList();
  renderCalendar();
  renderDayDetail(selectedDay);

// Função para salvar a delegação de tarefas de forma dinâmica
window.saveDelegation = function(id, iso) {
  const input = document.getElementById(`delegate-input-${id}`);
  const name = input.value.trim();
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.delegatedTo = name || null; // Atualiza o responsável no array
    renderCalendar();
    renderDayDetail(iso);
  }
};

// Função para apagar tarefas diretamente pela lista
window.deleteTaskInline = function(id, iso) {
  if (confirm("Tem certeza que deseja apagar este compromisso?")) {
    tasks = tasks.filter(t => t.id !== id);
    renderCalendar();
    renderDayDetail(iso);
  }
};

// Função para editar as informações essenciais da tarefa
window.editTaskInline = function(id, iso) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const novoTitulo = prompt("Editar Título da Tarefa:", task.title);
  if (novoTitulo === null) return; // Se a usuária cancelar, interrompe

  const novoLocal = prompt("Editar Local/Informações extras:", task.place);
  const novoHorario = prompt("Editar Horário (Exemplo: 14:30):", task.time);

  if (novoTitulo.trim() === "") {
    alert("O título não pode ficar em branco.");
    return;
  }

  task.title = novoTitulo.trim();
  task.place = novoLocal ? novoLocal.trim() : '';

  // Validação simples de formato de hora (HH:MM)
  if (novoHorario && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(novoHorario)) {
    task.time = novoHorario;
  }

  renderCalendar();
  renderDayDetail(iso);
};
})();