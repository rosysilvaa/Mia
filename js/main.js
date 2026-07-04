(function(){
  // ---------- ESTADO ----------
  const CATEGORY_LABEL = { eu:'Eu', familia:'Família', trabalho:'Trabalho' };
  const STORAGE_KEY = 'mia.tasks';
  const CHAT_PENDING_KEY = 'mia.pendingChatMessage';
  const EMERGENCY_DRAFT_KEY = 'mia.emergencyDraft';
  const EMERGENCY_TASK_KEY = 'mia.emergencyTaskId';
  const EMERGENCY_CONTACT_KEY = 'mia.emergencyContactId';
  const EMERGENCY_CONTACT_LABEL = {
    eu: 'Contato pessoal de confiança',
    familia: 'Marido ou familiar de apoio',
    trabalho: 'Gerente ou sócio',
    default: 'Contato de confiança'
  };
  const EMERGENCY_CONTACTS = [
    { id:'marido', label:'Marido', hint:'Apoio pessoal' },
    { id:'mae', label:'Mãe', hint:'Apoio familiar' },
    { id:'amiga', label:'Amiga', hint:'Pessoa de confiança' },
    { id:'gerente', label:'Gerente', hint:'Contato do trabalho' },
    { id:'socio', label:'Sócio', hint:'Contato do trabalho' },
  ];
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
  let emergencyDraft = null;
  let selectedEmergencyTaskId = null;
  let selectedEmergencyContactId = null;

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

  function formatLongDate(iso){
    const [y,m,d] = iso.split('-').map(Number);
    const dt = new Date(y, m-1, d);
    return `${d} de ${meses[dt.getMonth()]}`;
  }

  function getEmergencyContextLabel(task){
    if(!task) return 'compromisso pessoal';
    if(task.category === 'trabalho') return 'compromisso de trabalho';
    if(task.category === 'familia') return 'compromisso familiar';
    return 'compromisso pessoal';
  }

  function getEmergencyContactLabel(task){
    return EMERGENCY_CONTACT_LABEL[task?.category] || EMERGENCY_CONTACT_LABEL.default;
  }

  function getPreferredEmergencyContact(task){
    if(task?.category === 'trabalho') return 'gerente';
    if(task?.category === 'familia') return 'mae';
    return 'amiga';
  }

  function findEmergencyTask(taskId){
    return sortedTasks().find((task)=> String(task.id) === String(taskId)) || null;
  }

  function findEmergencyContact(contactId){
    return EMERGENCY_CONTACTS.find((contact)=> contact.id === contactId) || EMERGENCY_CONTACTS[0];
  }

  function getUpcomingEmergencyTask(){
    const upcoming = sortedTasks().filter((task)=>{
      const taskDate = new Date(`${task.date}T${task.time}:00`);
      return Number.isFinite(taskDate.getTime()) && taskDate >= new Date();
    });
    return upcoming[0] || sortedTasks()[0] || null;
  }

  function buildEmergencyDraft(task, contact){
    const safeTask = task || { title:'Compromisso próximo', category:'eu', date:todayISO(), time:'09:00', place:'' };
    const safeContact = contact || findEmergencyContact(getPreferredEmergencyContact(safeTask));
    const contactLabel = safeContact.label;
    const contextLabel = getEmergencyContextLabel(safeTask);
    const locationLabel = safeTask.place ? safeTask.place : 'Localização pessoal não informada';
    const message = [
      `Oi, ${contactLabel}.`,
      '',
      'A MIA identificou um compromisso próximo e pode ser importante você ficar por perto.',
      '',
      `Compromisso: ${safeTask.title}`,
      `Contexto: ${contextLabel}`,
      `Horário: ${formatLongDate(safeTask.date)} às ${safeTask.time}`,
      `Localização pessoal: ${locationLabel}`,
      '',
      'Se puder, assuma a frente e ofereça apoio quando necessário.'
    ].join('\n');

    return {
      task: safeTask,
      contactLabel,
      contactId: safeContact.id,
      contextLabel,
      locationLabel,
      message,
    };
  }

  function resetEmergencyModal(){
    const confirmOverlay = document.getElementById('overlay-emergency-confirm');
    if(confirmOverlay) confirmOverlay.classList.remove('open');
  }

  function renderEmergencySelectors(task, contact){
    const taskSelect = document.getElementById('emg-task-select');
    const contactSelect = document.getElementById('emg-contact-select');
    if(taskSelect && !taskSelect.dataset.ready){
      taskSelect.innerHTML = sortedTasks().map((item)=>{
        const dateLabel = formatLongDate(item.date);
        return `<option value="${item.id}">${item.title} · ${dateLabel} às ${item.time}</option>`;
      }).join('');
      taskSelect.dataset.ready = 'true';
    }
    if(contactSelect && !contactSelect.dataset.ready){
      contactSelect.innerHTML = EMERGENCY_CONTACTS.map((item)=> `<option value="${item.id}">${item.label} · ${item.hint}</option>`).join('');
      contactSelect.dataset.ready = 'true';
    }
    if(taskSelect && task) taskSelect.value = String(task.id);
    if(contactSelect && contact) contactSelect.value = contact.id;
  }

  function renderEmergencyModal(){
    const title = document.getElementById('emg-task-title');
    const meta = document.getElementById('emg-task-meta');
    const contact = document.getElementById('emg-suggested-contact');
    const intro = document.getElementById('emg-intro');
    const preview = document.getElementById('emg-message-preview');
    const taskSelect = document.getElementById('emg-task-select');
    const contactSelect = document.getElementById('emg-contact-select');
    const task = findEmergencyTask(selectedEmergencyTaskId) || getUpcomingEmergencyTask();
    const contactChoice = findEmergencyContact(selectedEmergencyContactId) || findEmergencyContact(getPreferredEmergencyContact(task));
    emergencyDraft = buildEmergencyDraft(task, contactChoice);
    selectedEmergencyTaskId = emergencyDraft.task.id;
    selectedEmergencyContactId = emergencyDraft.contactId;

    if(title) title.textContent = emergencyDraft.task.title;
    if(meta) meta.textContent = `${formatLongDate(emergencyDraft.task.date)} · ${emergencyDraft.task.time} · ${emergencyDraft.contextLabel}`;
    if(contact) contact.textContent = emergencyDraft.contactLabel;
    if(intro) intro.textContent = 'A MIA já deixou uma mensagem pronta com o contexto do compromisso, a localização pessoal e o contato sugerido. Você só revisa e confirma o envio.';
    if(preview) preview.textContent = emergencyDraft.message;

    renderEmergencySelectors(emergencyDraft.task, contactChoice);
    if(taskSelect && !taskSelect.dataset.bound){
      taskSelect.addEventListener('change', ()=>{
        selectedEmergencyTaskId = taskSelect.value;
        const nextTask = findEmergencyTask(selectedEmergencyTaskId) || getUpcomingEmergencyTask();
        selectedEmergencyContactId = getPreferredEmergencyContact(nextTask);
        renderEmergencyModal();
      });
      taskSelect.dataset.bound = 'true';
    }
    if(contactSelect && !contactSelect.dataset.bound){
      contactSelect.addEventListener('change', ()=>{
        selectedEmergencyContactId = contactSelect.value;
        renderEmergencyModal();
      });
      contactSelect.dataset.bound = 'true';
    }

    sessionStorage.setItem(EMERGENCY_DRAFT_KEY, JSON.stringify(emergencyDraft));
    sessionStorage.setItem(EMERGENCY_TASK_KEY, String(selectedEmergencyTaskId));
    sessionStorage.setItem(EMERGENCY_CONTACT_KEY, String(selectedEmergencyContactId));
    resetEmergencyModal();
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
  const addTaskButtons = ['btn-add-task', 'btn-add-task-inline'];
  if(overlayAdd){
    addTaskButtons.forEach((buttonId)=>{
      const button = document.getElementById(buttonId);
      if(button) button.addEventListener('click', ()=>{
      const newDate = document.getElementById('new-date');
      if(newDate) newDate.value = todayISO();
      overlayAdd.classList.add('open');
      });
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
    if(!overlayEmg) return;
    selectedEmergencyTaskId = sessionStorage.getItem(EMERGENCY_TASK_KEY) || null;
    selectedEmergencyContactId = sessionStorage.getItem(EMERGENCY_CONTACT_KEY) || null;
    renderEmergencyModal();
    overlayEmg.classList.add('open');
  }
  if(overlayEmg){
    const emergencyButtons = ['btn-emergency', 'btn-emergency-2'];
    emergencyButtons.forEach((buttonId)=>{
      const button = document.getElementById(buttonId);
      if(button) button.addEventListener('click', openEmergency);
    });
    const closeEmergency = document.getElementById('close-emergency');
    const openConfirmButton = document.getElementById('emg-open-confirm');
    const confirmOverlay = document.getElementById('overlay-emergency-confirm');
    const cancelConfirm = document.getElementById('emg-cancel-confirm');
    const confirmSend = document.getElementById('emg-confirm-send');

    if(closeEmergency) closeEmergency.addEventListener('click', ()=> overlayEmg.classList.remove('open'));
    if(openConfirmButton && confirmOverlay){
      openConfirmButton.addEventListener('click', ()=> confirmOverlay.classList.add('open'));
    }
    if(cancelConfirm && confirmOverlay){
      cancelConfirm.addEventListener('click', ()=> confirmOverlay.classList.remove('open'));
    }
    if(confirmSend){
      confirmSend.addEventListener('click', ()=>{
        if(!emergencyDraft) return;
        sessionStorage.setItem(EMERGENCY_DRAFT_KEY, JSON.stringify(emergencyDraft));
        overlayEmg.classList.remove('open');
        if(confirmOverlay) confirmOverlay.classList.remove('open');
        alert(`Mensagem enviada para ${emergencyDraft.contactLabel}.`);
      });
    }
    overlayEmg.addEventListener('click', (e)=>{ if(e.target === overlayEmg) overlayEmg.classList.remove('open'); });
    if(confirmOverlay) confirmOverlay.addEventListener('click', (e)=>{ if(e.target === confirmOverlay) confirmOverlay.classList.remove('open'); });
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

  const calPrev = document.getElementById('cal-prev');
  if(calPrev){
    calPrev.addEventListener('click', ()=>{
      calCursor.setMonth(calCursor.getMonth()-1);
      renderCalendar();
    });
  }
  const calNext = document.getElementById('cal-next');
  if(calNext){
    calNext.addEventListener('click', ()=>{
      calCursor.setMonth(calCursor.getMonth()+1);
      renderCalendar();
    });
  }

  // ---------- CHAT COM A MIA ----------
  const chatBody = document.getElementById('chat-body');

  function addMessage(text, who){
    if(!chatBody) return;
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTyping(){
    if(!chatBody) return;
    const el = document.createElement('div');
    el.className = 'typing';
    el.id = 'typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function hideTyping(){
    if(!chatBody) return;
    const el = document.getElementById('typing-indicator');
    if(el) el.remove();
  }

  function miaReply(userText){
    const text = userText.toLowerCase();
    const proximo = sortedTasks()[0];

    if(/(agenda|compromisso|tarefa|hoje)/.test(text)){
      if(proximo){
        const { num, mes } = fmtDay(proximo.date);
        return `Seu próximo compromisso é "${proximo.title}" em ${num} de ${mes}, às ${proximo.time}. Quer que eu te lembre um pouco antes?`;
      }
      return 'Você não tem compromissos marcados agora. Que tal usar esse tempo só pra você?';
    }
    if(/(cansad|exaust|sem força|não aguento|dificil|difícil)/.test(text)){
      return 'Sinto muito que esteja assim. É normal se sentir cansada fazendo tudo sozinha — isso não diminui sua força. Quer que eu ajude a organizar algo pra aliviar seu dia?';
    }
    if(/(sozinha|solidão|sozinho)/.test(text)){
      return 'Você não está sozinha nisso. Estou aqui com você, e existem redes de apoio também — posso te mostrar os contatos de emergência se quiser.';
    }
    if(/(obrigad)/.test(text)){
      return 'Eu que agradeço por confiar em mim. Estou sempre por aqui. 💛';
    }
    if(/(adicionar|criar|marcar|lembrar)/.test(text)){
      return 'Posso te ajudar com isso! Toque no botão "+" na tela inicial pra adicionar um novo compromisso rapidinho.';
    }
    const genericas = [
      'Estou aqui com você. Me conta um pouco mais?',
      'Entendi. Quer que eu te ajude a organizar isso na sua agenda?',
      'Você está indo bem, mesmo quando não parece. O que mais posso fazer por você agora?',
      'Anotado. Se precisar, posso transformar isso em um lembrete na sua agenda.'
    ];
    return genericas[Math.floor(Math.random()*genericas.length)];
  }

  function sendChat(text){
    if(!text.trim()) return;
    addMessage(text, 'user');
    showTyping();
    setTimeout(()=>{
      hideTyping();
      addMessage(miaReply(text), 'mia');
    }, 850 + Math.random()*500);
  }

  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');
  if(chatBody){
    addMessage('Oi, Juliana. Eu sou a MIA — estou aqui pra te ajudar a organizar o dia e, principalmente, pra te ouvir. Como você está agora?', 'mia');

    const pendingMessage = sessionStorage.getItem(CHAT_PENDING_KEY);
    if(pendingMessage){
      sessionStorage.removeItem(CHAT_PENDING_KEY);
      setTimeout(()=> sendChat(pendingMessage), 250);
    }

    if(chatSend && chatInput){
      chatSend.addEventListener('click', ()=>{
        sendChat(chatInput.value);
        chatInput.value = '';
      });
      chatInput.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter'){
          sendChat(e.target.value);
          e.target.value = '';
        }
      });
    }
  }

  // busca/pergunta na home também conversa com a MIA (leva pro chat)
  function goToChatWithMessage(text){
    const trimmed = text.trim();
    if(trimmed) sessionStorage.setItem(CHAT_PENDING_KEY, trimmed);
    window.location.href = 'pages/chat.html';
  }
  const homeSend = document.getElementById('home-send');
  const homeSearch = document.getElementById('home-search');
  if(homeSend && homeSearch){
    homeSend.addEventListener('click', ()=>{
      goToChatWithMessage(homeSearch.value);
      homeSearch.value = '';
    });
    homeSearch.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){ goToChatWithMessage(e.target.value); e.target.value=''; }
    });
  }

  // microfone (simulação de escuta)
  function wireMic(btnId, inputId){
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if(!btn || !input) return;
    btn.addEventListener('click', ()=>{
      btn.classList.add('mic-active');
      const placeholderBefore = input.placeholder;
      input.placeholder = 'Ouvindo...';
      setTimeout(()=>{
        btn.classList.remove('mic-active');
        input.placeholder = placeholderBefore;
      }, 1600);
    });
  }
  wireMic('home-mic', 'home-search');
  wireMic('chat-mic', 'chat-input');

  // ---------- INICIALIZAÇÃO ----------
  renderTodayPill();
  renderTaskList();
  renderCalendar();
  renderDayDetail(selectedDay);
})();