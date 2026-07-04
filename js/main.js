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

  function getDayDotCategories(dayTasks){
    if(!dayTasks || !dayTasks.length) return [];
    if(dayTasks.length === 1) return [dayTasks[0].category];
    const firstTwo = dayTasks.slice(0, 2).map((task)=> task.category);
    return firstTwo.length === 1 ? [firstTwo[0], firstTwo[0]] : firstTwo;
  }

  function openTaskDetail(task){
    const overlayDetail = document.getElementById('overlay-detail');
    if(!overlayDetail || !task) return;

    const detailBadge = document.getElementById('detail-badge');
    const detailTitle = document.getElementById('detail-title');
    const detailDate = document.getElementById('detail-date');
    const detailTime = document.getElementById('detail-time');
    const detailPlace = document.getElementById('detail-place');
    const detailPlaceWrapper = document.getElementById('detail-place-wrapper');
    const detailIA = document.getElementById('detail-ia-text');
    const detailDelegate = document.getElementById('detail-delegate-select');
    const delegatedStatusText = document.getElementById('delegated-status-text');

    if(detailBadge){
      detailBadge.textContent = CATEGORY_LABEL[task.category] || 'Categoria';
      detailBadge.className = `badge ${task.category}`;
    }
    if(detailTitle) detailTitle.textContent = task.title;
    if(detailDate) detailDate.textContent = task.date.split('-').reverse().join('/');
    if(detailTime) detailTime.textContent = task.time;
    if(detailPlace) detailPlace.textContent = task.place || 'Local não informado';
    if(detailPlaceWrapper) detailPlaceWrapper.style.display = 'block';
    if(detailIA){
      detailIA.textContent = task.category === 'trabalho'
        ? 'MIA diz: Para um compromisso de trabalho, vale deixar tudo organizado com antecedência e pedir apoio se o dia apertar.'
        : task.category === 'familia'
          ? 'MIA diz: Compromissos com a família costumam pesar mais na rotina. Se precisar, peça ajuda sem culpa.'
          : 'MIA diz: Esse é o seu momento. Tente preservar esse compromisso como um cuidado com você.';
    }
    if(detailDelegate) detailDelegate.value = '';
    if(delegatedStatusText){
      delegatedStatusText.style.display = 'none';
      delegatedStatusText.textContent = '';
    }

    overlayDetail.classList.add('open');
  }

  const overlayDetail = document.getElementById('overlay-detail');
  if(overlayDetail){
    const closeDetail = document.getElementById('close-detail');
    if(closeDetail) closeDetail.addEventListener('click', ()=> overlayDetail.classList.remove('open'));
    overlayDetail.addEventListener('click', (e)=>{ if(e.target === overlayDetail) overlayDetail.classList.remove('open'); });
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
      card.addEventListener('click', ()=> openTaskDetail(t));
      list.appendChild(card);
    });
    const verMaisBtn = document.getElementById('ver-mais-btn');
    if(verMaisBtn){
      verMaisBtn.style.display = ordered.length > 3 ? 'block' : 'none';
      verMaisBtn.textContent = showingAll ? 'Ver menos' : 'Ver mais';
    }
  }

  function formatDateBR(iso){
    if(!iso) return 'sem data';
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  function buildEmergencyOptions(){
    const defaultContacts = [
      { id: 'contato-chefe', name: 'Chefe - Carlos', phone: '(11) 99999-0001' },
      { id: 'contato-coordenadora', name: 'Coordenação - Patrícia', phone: '(11) 98888-2222' },
      { id: 'contato-rh', name: 'RH - Juliana', phone: '(11) 97777-3333' },
      { id: 'contato-lider', name: 'Liderança - André', phone: '(11) 96666-4444' },
    ];
    const workTasks = sortedTasks().filter((task)=> task.category === 'trabalho');
    return {
      contacts: defaultContacts,
      tasks: workTasks.length ? workTasks.slice(0, 5) : [
        { id: 901, title: 'Reunião com a equipe', category: 'trabalho', date: todayISO(), time: '09:00', place: 'Sala de reunião' },
        { id: 902, title: 'Reunião com a coordenação', category: 'trabalho', date: addDays(1), time: '14:30', place: 'Escritório' },
      ],
    };
  }

  function updateEmergencyPreview(){
    const taskSelect = document.getElementById('emg-task-select');
    const contactSelect = document.getElementById('emg-contact-select');
    const taskTitle = document.getElementById('emg-task-title');
    const taskMeta = document.getElementById('emg-task-meta');
    const suggestedContact = document.getElementById('emg-suggested-contact');
    const messagePreview = document.getElementById('emg-message-preview');
    const confirmCopy = document.getElementById('emg-confirm-copy');

    if(!taskSelect || !contactSelect || !taskTitle || !taskMeta || !suggestedContact || !messagePreview || !confirmCopy) return;

    const selectedTask = tasks.find((task)=> String(task.id) === taskSelect.value) || tasks[0] || null;
    const selectedContact = contactSelect.options[contactSelect.selectedIndex] || null;
    const contactLabel = selectedContact ? selectedContact.textContent : 'Contato de confiança';

    if(selectedTask){
      taskTitle.textContent = selectedTask.title;
      taskMeta.textContent = `${formatDateBR(selectedTask.date)} às ${selectedTask.time} · ${selectedTask.place || 'sem local informado'}`;
    } else {
      taskTitle.textContent = 'Compromisso próximo';
      taskMeta.textContent = 'Horário e contexto serão preenchidos pela MIA.';
    }

    suggestedContact.textContent = contactLabel;

    const messageLines = [
      `Oi, ${contactLabel}.`,
      '',
      selectedTask
        ? `Estou com um compromisso de trabalho (${selectedTask.title}) e não vou conseguir comparecer, em ${formatDateBR(selectedTask.date)} às ${selectedTask.time}.`
        : 'Estou com um compromisso de trabalho e não vou conseguir comparecer no horário previsto.',
      selectedTask?.place ? `Local: ${selectedTask.place}.` : 'Local: estou em deslocamento para o compromisso.',
      '',
      'Por favor, avise o chefe e considere isso como uma prioridade.'
    ];

    messagePreview.textContent = messageLines.join('\n');
    confirmCopy.textContent = `Essa mensagem será enviada para ${contactLabel}${selectedTask ? ` sobre ${selectedTask.title}` : ''}.`;
  }

  function fillEmergencyDemoData(){
    const taskSelect = document.getElementById('emg-task-select');
    const contactSelect = document.getElementById('emg-contact-select');
    if(!taskSelect || !contactSelect) return;

    const { contacts, tasks: emergencyTasks } = buildEmergencyOptions();

    taskSelect.innerHTML = emergencyTasks.map((task)=> `
      <option value="${task.id}">${task.title} - ${formatDateBR(task.date)} ${task.time}</option>
    `).join('');

    contactSelect.innerHTML = contacts.map((contact)=> `
      <option value="${contact.id}">${contact.name} (${contact.phone})</option>
    `).join('');

    if(!taskSelect.value && emergencyTasks[0]) taskSelect.value = String(emergencyTasks[0].id);
    if(!contactSelect.value && contacts[0]) contactSelect.value = contacts[0].id;
    updateEmergencyPreview();
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
  function openEmergency(){
    fillEmergencyDemoData();
    if(overlayEmg) overlayEmg.classList.add('open');
  }
  if(overlayEmg){
    const emergencyButtons = document.querySelectorAll('.fab-emergency');
    emergencyButtons.forEach((button)=>{
      button.addEventListener('click', openEmergency);
    });
    const emergencyIds = ['btn-emergency', 'btn-emergency-2'];
    emergencyIds.forEach((buttonId)=>{
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

    const taskSelect = document.getElementById('emg-task-select');
    const contactSelect = document.getElementById('emg-contact-select');
    const confirmOpen = document.getElementById('emg-open-confirm');
    const cancelConfirm = document.getElementById('emg-cancel-confirm');
    const confirmSend = document.getElementById('emg-confirm-send');
    const overlayConfirm = document.getElementById('overlay-emergency-confirm');

    if(taskSelect) taskSelect.addEventListener('change', updateEmergencyPreview);
    if(contactSelect) contactSelect.addEventListener('change', updateEmergencyPreview);

    if(confirmOpen && overlayConfirm){
      confirmOpen.addEventListener('click', ()=>{
        updateEmergencyPreview();
        overlayConfirm.classList.add('open');
      });
    }

    if(cancelConfirm && overlayConfirm) cancelConfirm.addEventListener('click', ()=> overlayConfirm.classList.remove('open'));
    if(confirmSend && overlayConfirm){
      confirmSend.addEventListener('click', ()=>{
        overlayConfirm.classList.remove('open');
        overlayEmg.classList.remove('open');
        alert('Mensagem de demonstração pronta para envio.');
      });
    }
    if(overlayConfirm) overlayConfirm.addEventListener('click', (e)=>{ if(e.target === overlayConfirm) overlayConfirm.classList.remove('open'); });
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
      const dayTasks = tasksByDate[iso] || [];
      const dotCategories = getDayDotCategories(dayTasks);
      cell.innerHTML = `<span>${d}</span><div class="cal-dots">${dotCategories.map(c=>`<span style="background:var(--${c})"></span>`).join('')}</div>`;
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
      card.style.cursor = 'pointer';
      card.innerHTML = `
        <div class="task-time"><span class="day">${t.time.split(':')[0]}h</span><span>${t.time.split(':')[1]}</span></div>
        <div class="task-info"><h3>${t.title}</h3><p>${t.place || ''}</p></div>
        <span class="badge ${t.category}">${CATEGORY_LABEL[t.category]}</span>
      `;
      card.addEventListener('click', ()=> openTaskDetail(t));
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