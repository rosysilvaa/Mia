(function(){
  // ---------- ESTADO ----------
  const CATEGORY_LABEL = { eu:'Eu', familia:'Família', trabalho:'Trabalho' };
  const STORAGE_KEY = 'mia.tasks';
  const CHAT_PENDING_KEY = 'mia.pendingChatMessage';
  const AGENDA_PENDING_DATE_KEY = 'mia.pendingAgendaDate';
  const AGENDA_PENDING_TASK_KEY = 'mia.pendingAgendaTask';
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
    { id:7, title:'Academia / Treino rápido', category:'eu', date:todayISO(), time:'18:30', place:'Academia' },
    { id:8, title:'Comprar presente para tia Rosa', category:'familia', date:addDays(1), time:'10:00', place:'Shopping' },
    { id:9, title:'Dentista', category:'eu', date:addDays(3), time:'09:00', place:'Odontoclin' },
    { id:10, title:'Reunião de alinhamento', category:'trabalho', date:addDays(3), time:'15:00', place:'Zoom' }
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

  function getBasePath(){
    return window.location.pathname.includes('/pages/') ? '' : 'pages/';
  }

  function buildSearchResponse(task){
    const title = task && task.title ? task.title : 'compromisso';
    const dateBR = task && task.date ? task.date.split('-').reverse().join('/') : 'a confirmar';
    const time = task && task.time ? task.time : 'a confirmar';
    const place = task && task.place ? task.place : 'a confirmar';
    return `Olá, tudo bem? Juliana? Vou te enviar os detalhes da sua ${title.toLowerCase()}, local ${place}, dia ${dateBR} e horário ${time} e o nome do doutor.`;
  }

  function openAgendaForTask(task){
    if(!task) return;
    localStorage.setItem(AGENDA_PENDING_DATE_KEY, task.date);
    localStorage.setItem(AGENDA_PENDING_TASK_KEY, task.title);
    localStorage.setItem(CHAT_PENDING_KEY, buildSearchResponse(task));
    window.location.href = `${getBasePath()}agenda.html`;
  }

  // ---------- INTERPRETADOR DE LINGUAGEM NATURAL (BARRA DE PESQUISA -> TAREFA) ----------
  // Reconhece comandos como "Agende uma reunião para amanhã às 14h.",
  // "Marcar consulta médica na sexta às 9h." ou "Adicionar aniversário da Maria dia 15 às 19h."
  // e transforma automaticamente em um novo compromisso na Agenda.

  // Observação: usamos (?<!\p{L}) / (?!\p{L}) em vez de \b, porque \b (baseado em
  // [A-Za-z0-9_]) não reconhece corretamente limites de palavra em torno de letras
  // acentuadas do português (ã, à, á, ç...), o que faria palavras como "amanhã" ou "às"
  // não serem detectadas corretamente.
  const TRIGGER_VERB_REGEX = /(?<!\p{L})(agendar|agende|agenda|marcar|marca|marque|adicionar|adicione|criar|crie|cadastrar|cadastre|lembrar|lembre|colocar|coloque|incluir|inclua|anotar|anote|anota|salvar|salve|salva)(?!\p{L})/iu;

  const WEEKDAY_PATTERNS = [
    { index:0, regex:/(?<!\p{L})domingo(?!\p{L})/iu },
    { index:1, regex:/(?<!\p{L})segunda(-feira)?(?!\p{L})/iu },
    { index:2, regex:/(?<!\p{L})ter[cç]a(-feira)?(?!\p{L})/iu },
    { index:3, regex:/(?<!\p{L})quarta(-feira)?(?!\p{L})/iu },
    { index:4, regex:/(?<!\p{L})quinta(-feira)?(?!\p{L})/iu },
    { index:5, regex:/(?<!\p{L})sexta(-feira)?(?!\p{L})/iu },
    { index:6, regex:/(?<!\p{L})s[aá]bado(?!\p{L})/iu }
  ];

  function escapeRegExp(str){
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeAccents(str){
    return String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function nextDateForWeekday(targetDow){
    const d = new Date();
    const diff = (targetDow - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    return toISO(d);
  }

  function extractDate(text){
    let m = text.match(/(?<!\p{L})hoje(?!\p{L})/iu);
    if(m) return { iso: todayISO(), match: m[0] };

    m = text.match(/(?<!\p{L})depois de amanh[aã](?!\p{L})/iu);
    if(m) return { iso: addDays(2), match: m[0] };

    m = text.match(/(?<!\p{L})amanh[aã](?!\p{L})/iu);
    if(m) return { iso: addDays(1), match: m[0] };

    m = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if(m){
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10) - 1;
      let year = m[3] ? parseInt(m[3], 10) : new Date().getFullYear();
      if(year < 100) year += 2000;
      return { iso: toISO(new Date(year, month, day)), match: m[0] };
    }

    m = text.match(/(?<!\p{L})dia\s+(\d{1,2})(?:\s+de\s+([a-zçàáâãéêíóôõú]+))?(?!\p{L})/iu);
    if(m){
      const day = parseInt(m[1], 10);
      const now = new Date();
      let month = now.getMonth();
      const year = now.getFullYear();
      if(m[2]){
        const monthIdx = meses.findIndex((mm)=> mm.toLowerCase() === m[2].toLowerCase());
        if(monthIdx >= 0) month = monthIdx;
      }
      let candidate = new Date(year, month, day);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if(!m[2] && candidate < startOfToday){
        candidate = new Date(year, month + 1, day);
      }
      return { iso: toISO(candidate), match: m[0] };
    }

    for(const wp of WEEKDAY_PATTERNS){
      const wm = text.match(wp.regex);
      if(wm) return { iso: nextDateForWeekday(wp.index), match: wm[0] };
    }

    return null;
  }

  function extractTime(text){
    let m = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
    if(m){
      const hh = String(parseInt(m[1], 10)).padStart(2, '0');
      return { time: `${hh}:${m[2]}`, match: m[0] };
    }
    m = text.match(/\b([01]?\d|2[0-3])\s*h\b/i);
    if(m){
      const hh = String(parseInt(m[1], 10)).padStart(2, '0');
      return { time: `${hh}:00`, match: m[0] };
    }
    return null;
  }

  function removeMatchWithConnector(str, matchToken){
    if(!matchToken) return str;
    const escaped = escapeRegExp(matchToken);
    const withConnector = new RegExp(`(?<!\\p{L})(para|em|no|na|dia|de|às|as)\\s+${escaped}`, 'iu');
    if(withConnector.test(str)) return str.replace(withConnector, ' ');
    return str.replace(new RegExp(escaped, 'i'), ' ');
  }

  function cleanupTitle(str){
    let working = str.replace(/\s{2,}/g, ' ').trim();
    let prevLength;
    do{
      prevLength = working.length;
      working = working.replace(/^(uma|um|o|a|de|da|do|para|em|no|na|dia|às|as)\s+/i, '').trim();
    } while(working.length !== prevLength && working.length > 0);
    do{
      prevLength = working.length;
      working = working.replace(/\s+(para|em|no|na|de|às|as|dia)$/i, '').trim();
      working = working.replace(/[.,;:!]+$/, '').trim();
    } while(working.length !== prevLength && working.length > 0);
    return working;
  }

  function guessCategory(text){
    const t = normalizeAccents(text).toLowerCase();
    if(/\b(reuniao|trabalho|relatorio|projeto|cliente|equipe|chefe|escritorio)\b/.test(t)) return 'trabalho';
    if(/\b(aniversario|familia|escola|filho|filha|mae|pai|marido|esposa|avo|sobrinh\w*)\b/.test(t)) return 'familia';
    return 'eu';
  }

  function parseTaskCommand(rawText){
    const text = (rawText || '').trim();
    if(!text) return null;

    const hasTrigger = TRIGGER_VERB_REGEX.test(text);
    const dateInfo = extractDate(text);
    const timeInfo = extractTime(text);

    // Só interpreta como criação de tarefa se houver um verbo de comando
    // OU se data e horário estiverem presentes juntos (forte indício de agendamento).
    if(!hasTrigger && !(dateInfo && timeInfo)) return null;

    let working = text;
    working = working.replace(TRIGGER_VERB_REGEX, ' ');
    if(dateInfo) working = removeMatchWithConnector(working, dateInfo.match);
    if(timeInfo) working = removeMatchWithConnector(working, timeInfo.match);

    let title = cleanupTitle(working);
    if(!title) title = 'Novo compromisso';
    title = title.charAt(0).toUpperCase() + title.slice(1);

    return {
      title,
      date: dateInfo ? dateInfo.iso : todayISO(),
      time: timeInfo ? timeInfo.time : '09:00',
      category: guessCategory(text)
    };
  }

  function relativeDateLabel(iso){
    if(iso === todayISO()) return 'hoje';
    if(iso === addDays(1)) return 'amanhã';
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const startOfToday = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const diffDays = Math.round((dt - startOfToday) / 86400000);
    if(diffDays > 0 && diffDays <= 6) return diasSemana[dt.getDay()];
    return `dia ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
  }

  function buildTaskCreatedConfirmation(task){
    const dateLabel = relativeDateLabel(task.date);
    const templates = [
      `Certo! "${task.title}" foi agendado(a) para ${dateLabel} às ${task.time}. Já deixei tudo salvo na sua agenda. 🤍`,
      `${task.title} adicionado(a) com sucesso para ${dateLabel} às ${task.time}.`,
      `Prontinho! Marquei "${task.title}" para ${dateLabel} às ${task.time}. Você pode conferir na sua agenda quando quiser.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  function createTaskFromCommand(parsed){
    const task = { id: nextId++, title: parsed.title, category: parsed.category, date: parsed.date, time: parsed.time, place: '' };
    tasks.push(task);
    saveTasks();

    // Atualiza a lista de compromissos e o calendário imediatamente, sem recarregar a página
    // (renderCalendar/renderDayDetail não fazem nada em telas onde os elementos não existem).
    selectedDay = task.date;
    renderTaskList();
    renderCalendar();
    renderDayDetail(task.date);

    const confirmation = buildTaskCreatedConfirmation(task);
    localStorage.setItem(AGENDA_PENDING_DATE_KEY, task.date);
    localStorage.setItem(AGENDA_PENDING_TASK_KEY, task.title);
    localStorage.setItem(CHAT_PENDING_KEY, confirmation);
    window.location.href = `${getBasePath()}agenda.html`;
  }

  function handleHomeSearch(query){
    const text = (query || '').trim();
    if(!text) return;

    const parsedTask = parseTaskCommand(text);
    if(parsedTask){
      createTaskFromCommand(parsedTask);
      return;
    }

    const normalized = text.toLowerCase();
    const match = tasks.find((task)=> task.title.toLowerCase().includes(normalized));
    if(match){
      openAgendaForTask(match);
      return;
    }
    localStorage.setItem(CHAT_PENDING_KEY, `Olá, tudo bem? Juliana? Vou te ajudar com: ${text}`);
    window.location.href = `${getBasePath()}chat.html`;
  }

  const homeSearch = document.getElementById('home-search');
  const homeSend = document.getElementById('home-send');
  const homeMic = document.getElementById('home-mic');

  if(homeSearch && homeSend){
    const submitHomeSearch = ()=>{
      handleHomeSearch(homeSearch.value);
      homeSearch.value = '';
    };
    homeSend.addEventListener('click', submitHomeSearch);
    homeSearch.addEventListener('keydown', (event)=>{
      if(event.key === 'Enter'){
        event.preventDefault();
        submitHomeSearch();
      }
    });
  }

  if(homeMic && homeSearch){
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(SpeechRecognition){
      const recognizer = new SpeechRecognition();
      recognizer.lang = 'pt-BR';
      recognizer.continuous = false;
      recognizer.interimResults = false;
      recognizer.onresult = (event)=>{
        const transcript = event.results[0][0].transcript.trim();
        if(transcript){
          homeSearch.value = transcript;
          handleHomeSearch(transcript);
        }
      };
      recognizer.onerror = ()=> homeMic.classList.remove('listening');
      recognizer.onend = ()=> homeMic.classList.remove('listening');
      homeMic.addEventListener('click', ()=>{
        if(homeMic.classList.contains('listening')){
          recognizer.stop();
          return;
        }
        homeMic.classList.add('listening');
        recognizer.start();
      });
    } else {
      homeMic.addEventListener('click', ()=>{
        alert('Reconhecimento de voz não está disponível neste navegador.');
      });
    }
  }

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
    // Se houver duas ou mais tarefas, retorna as categorias das duas primeiras
    return [dayTasks[0].category, dayTasks[1].category];
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

    // Reset view/edit modes
    const viewMode = document.getElementById('detail-view-mode');
    const editMode = document.getElementById('detail-edit-mode');
    const btnSave = document.getElementById('save-detail-changes');
    if(viewMode) viewMode.style.display = 'block';
    if(editMode) editMode.style.display = 'none';
    if(btnSave) btnSave.style.display = 'none';

    // Setup Delegation
    if(detailDelegate){
      const newDelegate = detailDelegate.cloneNode(true);
      detailDelegate.parentNode.replaceChild(newDelegate, detailDelegate);
      
      if(task.delegatedTo){
        newDelegate.value = task.delegatedTo;
        if(delegatedStatusText){
          delegatedStatusText.style.display = 'block';
          delegatedStatusText.textContent = `Tarefa delegada para: ${task.delegatedTo}`;
        }
      } else {
        newDelegate.value = '';
        if(delegatedStatusText) delegatedStatusText.style.display = 'none';
      }

      newDelegate.addEventListener('change', ()=>{
        task.delegatedTo = newDelegate.value || null;
        saveTasks();
        if(task.delegatedTo){
          if(delegatedStatusText){
            delegatedStatusText.style.display = 'block';
            delegatedStatusText.textContent = `Tarefa delegada para: ${task.delegatedTo}`;
          }
        } else {
          if(delegatedStatusText) delegatedStatusText.style.display = 'none';
        }
        renderTaskList();
        renderCalendar();
        renderDayDetail(selectedDay);
      });
    } else {
      if(delegatedStatusText) delegatedStatusText.style.display = 'none';
    }

    // Setup Delete Button
    const btnDelete = document.getElementById('btn-delete-task');
    if(btnDelete){
      const newBtnDelete = btnDelete.cloneNode(true);
      btnDelete.parentNode.replaceChild(newBtnDelete, btnDelete);
      newBtnDelete.addEventListener('click', ()=>{
        if(confirm("Tem certeza que deseja excluir esta tarefa?")){
          tasks = tasks.filter(t => t.id !== task.id);
          saveTasks();
          overlayDetail.classList.remove('open');
          renderTaskList();
          renderCalendar();
          renderDayDetail(selectedDay);
        }
      });
    }

    // Setup Edit and Save Button
    const btnEdit = document.getElementById('btn-edit-task');
    if(btnEdit){
      const newBtnEdit = btnEdit.cloneNode(true);
      btnEdit.parentNode.replaceChild(newBtnEdit, btnEdit);
      newBtnEdit.addEventListener('click', ()=>{
        if(viewMode && editMode && btnSave){
          const isEditing = editMode.style.display === 'block';
          if(isEditing){
            editMode.style.display = 'none';
            viewMode.style.display = 'block';
            btnSave.style.display = 'none';
          } else {
            document.getElementById('edit-title').value = task.title;
            document.getElementById('edit-date').value = task.date;
            document.getElementById('edit-time').value = task.time;
            document.getElementById('edit-place').value = task.place || '';
            
            editMode.style.display = 'block';
            viewMode.style.display = 'none';
            btnSave.style.display = 'block';
          }
        }
      });
    }

    if(btnSave){
      const newBtnSave = btnSave.cloneNode(true);
      btnSave.parentNode.replaceChild(newBtnSave, btnSave);
      newBtnSave.addEventListener('click', ()=>{
        const editTitle = document.getElementById('edit-title');
        const editDate = document.getElementById('edit-date');
        const editTime = document.getElementById('edit-time');
        const editPlace = document.getElementById('edit-place');

        const newTitle = editTitle ? editTitle.value.trim() : '';
        const newDate = editDate ? editDate.value : '';
        const newTime = editTime ? editTime.value : '';
        const newPlace = editPlace ? editPlace.value.trim() : '';

        if(!newTitle){
          alert("O título não pode ficar em branco.");
          return;
        }

        task.title = newTitle;
        if(newDate) task.date = newDate;
        if(newTime) task.time = newTime;
        task.place = newPlace;

        saveTasks();
        overlayDetail.classList.remove('open');
        renderTaskList();
        renderCalendar();
        renderDayDetail(selectedDay);
      });
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

  // ---------- DADOS: GESTOR E CONTATOS DE APOIO (EMERGÊNCIA) ----------
  const MANAGER_KEY = 'mia.manager';
  const SUPPORT_CONTACTS_KEY = 'mia.supportContacts';

  function loadManager(){
    try{
      const saved = localStorage.getItem(MANAGER_KEY);
      if(!saved) return null;
      const parsed = JSON.parse(saved);
      const normalizedName = String(parsed && parsed.name ? parsed.name : '').trim().toLowerCase();
      if(parsed && parsed.name && parsed.phone && normalizedName !== 'rose'){
        return parsed;
      }
      localStorage.removeItem(MANAGER_KEY);
      return null;
    } catch {
      localStorage.removeItem(MANAGER_KEY);
      return null;
    }
  }
  function loadSupportContacts(){
    try{
      const saved = localStorage.getItem(SUPPORT_CONTACTS_KEY);
      if(!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  let manager = loadManager();
  let supportContacts = loadSupportContacts();
  if(!localStorage.getItem(SUPPORT_CONTACTS_KEY)) localStorage.setItem(SUPPORT_CONTACTS_KEY, JSON.stringify(supportContacts));

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

  // ---------- MÓDULO: BOTÃO DE EMERGÊNCIA ----------
  const overlayEmg = document.getElementById('overlay-emergency');
  if(overlayEmg){
    const overlayManager = document.getElementById('overlay-emergency-manager');
    const overlayManagerMsg = document.getElementById('overlay-emergency-manager-message');
    const overlayManagerRegister = document.getElementById('overlay-emergency-manager-register');
    const overlayContactRegister = document.getElementById('overlay-emergency-contact-register');
    const overlayContactCall = document.getElementById('overlay-emergency-contact-call');
    const overlayContactMsg = document.getElementById('overlay-emergency-contact-message');
    const overlayConfirm = document.getElementById('overlay-emergency-confirm');
    const allEmgOverlays = [overlayEmg, overlayManager, overlayManagerMsg, overlayManagerRegister, overlayContactRegister, overlayContactCall, overlayContactMsg, overlayConfirm].filter(Boolean);

    let selectedContactIds = new Set();
    let pendingSendAction = null;
    let cachedLocationLink = null;

    function openOverlay(el){ if(el) el.classList.add('open'); }
    function closeOverlay(el){ if(el) el.classList.remove('open'); }
    function closeAllEmergencyOverlays(){ allEmgOverlays.forEach(closeOverlay); }

    function onlyDigits(str){ return String(str || '').replace(/\D/g,''); }
    function buildWhatsAppLink(phone, text){
      return `https://wa.me/${onlyDigits(phone)}?text=${encodeURIComponent(text)}`;
    }

    // -------- MODAL PRINCIPAL: "Avisar o gestor" / "Avisar um contato" --------
    function updateContinueButton(){
      const btn = document.getElementById('emg-continue-contacts');
      if(!btn) return;
      btn.disabled = selectedContactIds.size === 0;
      btn.textContent = selectedContactIds.size > 1 ? `Continuar (${selectedContactIds.size} contatos)` : 'Continuar';
    }

    function renderEmergencyMain(){
      const managerSlot = document.getElementById('emg-manager-slot');
      if(managerSlot){
        if(manager){
          managerSlot.innerHTML = `
            <button type="button" class="emg-item emg-item-btn" id="emg-open-manager">
              <span class="emg-ico">👤</span>
              <span><h4>${manager.name}</h4><p>Avisar ausência e enviar demandas pendentes</p></span>
            </button>
            <button type="button" class="btn-ghost" id="emg-add-manager-btn">Adicionar outro gestor</button>
          `;
        } else {
          managerSlot.innerHTML = `
            <div class="emg-item">
              <span class="emg-ico">➕</span>
              <span><h4>Nenhum gestor cadastrado</h4><p>Adicione um gestor para continuar.</p></span>
            </div>
            <button type="button" class="btn-primary" id="emg-add-manager-btn">Adicionar gestor</button>
          `;
        }
      }

      const managerButton = document.getElementById('emg-open-manager');
      if(managerButton){
        managerButton.addEventListener('click', ()=>{
          if(managerDaysInput) managerDaysInput.value = 1;
          renderManagerTasksPreview();
          closeOverlay(overlayEmg);
          openOverlay(overlayManager);
        });
      }

      const addManagerButton = document.getElementById('emg-add-manager-btn');
      if(addManagerButton){
        addManagerButton.addEventListener('click', ()=>{
          closeOverlay(overlayEmg);
          openOverlay(overlayManagerRegister);
        });
      }

      const list = document.getElementById('emg-contacts-list');
      if(!list) return;
      if(!supportContacts.length){
        list.innerHTML = `
          <div class="emg-item">
            <span class="emg-ico">➕</span>
            <span><h4>Nenhum contato cadastrado</h4><p>Adicione um contato para continuar.</p></span>
          </div>
          <button type="button" class="btn-primary" id="emg-add-contact-btn">Adicionar contato</button>
        `;
      } else {
        list.innerHTML = supportContacts.map((c)=> `
          <label class="emg-item emg-checkbox-item${selectedContactIds.has(c.id) ? ' checked' : ''}">
            <input type="checkbox" class="emg-contact-checkbox" value="${c.id}" ${selectedContactIds.has(c.id) ? 'checked' : ''}>
            <span class="emg-ico">🧑</span>
            <span><h4>${c.name}</h4><p>${c.phone}</p></span>
          </label>
        `).join('');

        list.querySelectorAll('.emg-contact-checkbox').forEach((checkbox)=>{
          checkbox.addEventListener('change', ()=>{
            const id = checkbox.value;
            if(checkbox.checked) selectedContactIds.add(id); else selectedContactIds.delete(id);
            checkbox.closest('.emg-checkbox-item').classList.toggle('checked', checkbox.checked);
            updateContinueButton();
          });
        });
      }

      const addContactButton = document.getElementById('emg-add-contact-btn');
      if(addContactButton){
        addContactButton.addEventListener('click', ()=>{
          closeOverlay(overlayEmg);
          openOverlay(overlayContactRegister);
        });
      }
      updateContinueButton();
    }

    function openEmergency(){
      renderEmergencyMain();
      openOverlay(overlayEmg);
    }

    document.querySelectorAll('.fab-emergency').forEach((button)=> button.addEventListener('click', openEmergency));
    ['btn-emergency', 'btn-emergency-2'].forEach((buttonId)=>{
      const button = document.getElementById(buttonId);
      if(button) button.addEventListener('click', openEmergency);
    });

    const closeEmergency = document.getElementById('close-emergency');
    if(closeEmergency) closeEmergency.addEventListener('click', ()=> closeOverlay(overlayEmg));
    overlayEmg.addEventListener('click', (e)=>{ if(e.target === overlayEmg) closeOverlay(overlayEmg); });

    // -------- FLUXO 1: AVISAR O GESTOR --------
    const btnOpenManager = document.getElementById('emg-open-manager');
    const managerDaysInput = document.getElementById('emg-manager-days');
    const managerTasksPreview = document.getElementById('emg-manager-tasks');

    function getManagerWorkTasks(days){
      const n = Math.max(1, parseInt(days, 10) || 1);
      const start = todayISO();
      const end = addDays(n - 1);
      return sortedTasks().filter((t)=> t.category === 'trabalho' && t.date >= start && t.date <= end);
    }

    function renderManagerTasksPreview(){
      if(!managerTasksPreview || !managerDaysInput) return;
      const workTasks = getManagerWorkTasks(managerDaysInput.value);
      managerTasksPreview.innerHTML = workTasks.length
        ? `<ul>${workTasks.map((t)=> `<li>${t.title} — ${formatDateBR(t.date)} às ${t.time}</li>`).join('')}</ul>`
        : `<p class="emg-task-empty">Nenhuma tarefa com a tag Trabalho nesse período.</p>`;
    }

    if(btnOpenManager){
      btnOpenManager.addEventListener('click', ()=>{
        if(managerDaysInput) managerDaysInput.value = 1;
        renderManagerTasksPreview();
        closeOverlay(overlayEmg);
        openOverlay(overlayManager);
      });
    }
    if(managerDaysInput) managerDaysInput.addEventListener('input', renderManagerTasksPreview);

    const managerBack = document.getElementById('emg-manager-back');
    if(managerBack) managerBack.addEventListener('click', ()=>{ closeOverlay(overlayManager); openEmergency(); });
    if(overlayManager) overlayManager.addEventListener('click', (e)=>{ if(e.target === overlayManager) closeOverlay(overlayManager); });

    const managerRegisterBack = document.getElementById('emg-manager-register-back');
    if(managerRegisterBack) managerRegisterBack.addEventListener('click', ()=>{ closeOverlay(overlayManagerRegister); openEmergency(); });
    if(overlayManagerRegister) overlayManagerRegister.addEventListener('click', (e)=>{ if(e.target === overlayManagerRegister) closeOverlay(overlayManagerRegister); });

    const contactRegisterBack = document.getElementById('emg-contact-register-back');
    if(contactRegisterBack) contactRegisterBack.addEventListener('click', ()=>{ closeOverlay(overlayContactRegister); openEmergency(); });
    if(overlayContactRegister) overlayContactRegister.addEventListener('click', (e)=>{ if(e.target === overlayContactRegister) closeOverlay(overlayContactRegister); });

    const contactRegisterSave = document.getElementById('emg-contact-register-save');
    if(contactRegisterSave){
      contactRegisterSave.addEventListener('click', ()=>{
        const nameInput = document.getElementById('emg-contact-register-name');
        const phoneInput = document.getElementById('emg-contact-register-phone');
        const name = nameInput ? nameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        if(!name || !phone){
          if(nameInput) nameInput.focus();
          return;
        }
        supportContacts = [...supportContacts, { id: `contato-${Date.now()}`, name, phone }];
        localStorage.setItem(SUPPORT_CONTACTS_KEY, JSON.stringify(supportContacts));
        renderEmergencyMain();
        closeOverlay(overlayContactRegister);
        openEmergency();
      });
    }

    const managerRegisterSave = document.getElementById('emg-manager-register-save');
    if(managerRegisterSave){
      managerRegisterSave.addEventListener('click', ()=>{
        const nameInput = document.getElementById('emg-manager-register-name');
        const phoneInput = document.getElementById('emg-manager-register-phone');
        const name = nameInput ? nameInput.value.trim() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        if(!name || !phone){
          if(nameInput) nameInput.focus();
          return;
        }
        manager = { name, phone };
        localStorage.setItem(MANAGER_KEY, JSON.stringify(manager));
        renderEmergencyMain();
        closeOverlay(overlayManagerRegister);
        openEmergency();
      });
    }

    const managerNext = document.getElementById('emg-manager-next');
    if(managerNext){
      managerNext.addEventListener('click', ()=>{
        const n = Math.max(1, parseInt(managerDaysInput ? managerDaysInput.value : 1, 10) || 1);
        const workTasks = getManagerWorkTasks(n);
        const dateLabel = n === 1 ? formatDateBR(todayISO()) : `${formatDateBR(todayISO())} a ${formatDateBR(addDays(n - 1))}`;

        const question = document.getElementById('emg-manager-message-question');
        if(question) question.textContent = `Você deseja enviar esta mensagem para ${manager.name} junto com as suas próximas demandas da empresa?`;

        const taskLines = workTasks.length
          ? workTasks.map((t)=> `- ${t.title} (${formatDateBR(t.date)} às ${t.time})`).join('\n')
          : '- Nenhuma tarefa de trabalho encontrada nesse período.';

        const messageText = [
          '🚨 Emergência',
          '',
          'Ocorreu uma emergência e preciso me ausentar imediatamente. Entrarei em contato assim que possível. Obrigado(a) pela compreensão.',
          '',
          `Segue aqui as minhas demandas do(s) dia(s) ${dateLabel}:`,
          '',
          taskLines
        ].join('\n');

        const textarea = document.getElementById('emg-manager-message-text');
        if(textarea) textarea.value = messageText;

        closeOverlay(overlayManager);
        openOverlay(overlayManagerMsg);
      });
    }

    const managerMsgBack = document.getElementById('emg-manager-message-back');
    if(managerMsgBack) managerMsgBack.addEventListener('click', ()=>{ closeOverlay(overlayManagerMsg); openOverlay(overlayManager); });
    if(overlayManagerMsg) overlayManagerMsg.addEventListener('click', (e)=>{ if(e.target === overlayManagerMsg) closeOverlay(overlayManagerMsg); });

    const managerSend = document.getElementById('emg-manager-send');
    if(managerSend){
      managerSend.addEventListener('click', ()=>{
        pendingSendAction = ()=>{
          const textarea = document.getElementById('emg-manager-message-text');
          const text = textarea ? textarea.value : '';
          window.open(buildWhatsAppLink(manager.phone, text), '_blank');
        };
        openOverlay(overlayConfirm);
      });
    }

    // -------- FLUXO 2: AVISAR UM CONTATO --------
    const continueContacts = document.getElementById('emg-continue-contacts');
    if(continueContacts){
      continueContacts.addEventListener('click', ()=>{
        if(selectedContactIds.size === 0) return;
        closeOverlay(overlayEmg);
        if(selectedContactIds.size === 1){
          const contact = supportContacts.find((c)=> selectedContactIds.has(c.id));
          const title = document.getElementById('emg-contact-call-title');
          if(title && contact) title.textContent = `O que você deseja fazer com ${contact.name}?`;
          openOverlay(overlayContactCall);
        } else {
          openContactMessageStep();
        }
      });
    }

    const contactCallBack = document.getElementById('emg-contact-call-back');
    if(contactCallBack) contactCallBack.addEventListener('click', ()=>{ closeOverlay(overlayContactCall); openEmergency(); });
    if(overlayContactCall) overlayContactCall.addEventListener('click', (e)=>{ if(e.target === overlayContactCall) closeOverlay(overlayContactCall); });

    const contactCallBtn = document.getElementById('emg-contact-call-btn');
    if(contactCallBtn){
      contactCallBtn.addEventListener('click', ()=>{
        const contact = supportContacts.find((c)=> selectedContactIds.has(c.id));
        if(contact) window.location.href = `tel:${onlyDigits(contact.phone)}`;
      });
    }

    const contactMessageBtn = document.getElementById('emg-contact-message-btn');
    if(contactMessageBtn){
      contactMessageBtn.addEventListener('click', ()=>{
        closeOverlay(overlayContactCall);
        openContactMessageStep();
      });
    }

    const shareLocationCheckbox = document.getElementById('emg-share-location');
    function buildContactMessage(withLocation){
      const lines = [
        '🚨 Emergência',
        '',
        'Ocorreu uma emergência e preciso da sua ajuda.',
        '',
        'Entre em contato comigo assim que possível.'
      ];
      if(withLocation){
        lines.push('', 'Estou compartilhando minha localização com você.');
        lines.push(cachedLocationLink || 'Localização: obtendo…');
      }
      return lines.join('\n');
    }

    function requestLocationLink(){
      return new Promise((resolve)=>{
        if(!navigator.geolocation){ resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos)=>{
            const { latitude, longitude } = pos.coords;
            resolve(`https://www.google.com/maps?q=${latitude},${longitude}`);
          },
          ()=> resolve(null),
          { timeout: 8000 }
        );
      });
    }

    function openContactMessageStep(){
      const contacts = supportContacts.filter((c)=> selectedContactIds.has(c.id));
      const names = contacts.map((c)=> c.name).join(', ');
      const question = document.getElementById('emg-contact-message-question');
      if(question) question.textContent = `Você deseja enviar esta mensagem para ${names}?`;
      if(shareLocationCheckbox) shareLocationCheckbox.checked = false;
      const textarea = document.getElementById('emg-contact-message-text');
      if(textarea) textarea.value = buildContactMessage(false);
      openOverlay(overlayContactMsg);
    }

    if(shareLocationCheckbox){
      shareLocationCheckbox.addEventListener('change', async ()=>{
        const textarea = document.getElementById('emg-contact-message-text');
        if(!shareLocationCheckbox.checked){
          if(textarea) textarea.value = buildContactMessage(false);
          return;
        }
        if(textarea) textarea.value = buildContactMessage(true);
        const link = await requestLocationLink();
        if(!link){
          alert('Não foi possível obter sua localização. Verifique as permissões do navegador.');
          shareLocationCheckbox.checked = false;
          if(textarea) textarea.value = buildContactMessage(false);
          return;
        }
        cachedLocationLink = link;
        if(textarea) textarea.value = buildContactMessage(true);
      });
    }

    const contactMsgBack = document.getElementById('emg-contact-message-back');
    if(contactMsgBack){
      contactMsgBack.addEventListener('click', ()=>{
        closeOverlay(overlayContactMsg);
        if(selectedContactIds.size === 1) openOverlay(overlayContactCall); else openEmergency();
      });
    }
    if(overlayContactMsg) overlayContactMsg.addEventListener('click', (e)=>{ if(e.target === overlayContactMsg) closeOverlay(overlayContactMsg); });

    const contactSend = document.getElementById('emg-contact-send');
    if(contactSend){
      contactSend.addEventListener('click', ()=>{
        pendingSendAction = ()=>{
          const textarea = document.getElementById('emg-contact-message-text');
          const text = textarea ? textarea.value : '';
          const contacts = supportContacts.filter((c)=> selectedContactIds.has(c.id));
          contacts.forEach((c)=> window.open(buildWhatsAppLink(c.phone, text), '_blank'));
        };
        openOverlay(overlayConfirm);
      });
    }

    // -------- CONFIRMAÇÃO FINAL (COMUM AOS DOIS FLUXOS) --------
    const cancelConfirm = document.getElementById('emg-cancel-confirm');
    if(cancelConfirm) cancelConfirm.addEventListener('click', ()=>{ pendingSendAction = null; closeOverlay(overlayConfirm); });

    const confirmSend = document.getElementById('emg-confirm-send');
    if(confirmSend){
      confirmSend.addEventListener('click', ()=>{
        if(pendingSendAction) pendingSendAction();
        pendingSendAction = null;
        closeAllEmergencyOverlays();
      });
    }
    if(overlayConfirm) overlayConfirm.addEventListener('click', (e)=>{ if(e.target === overlayConfirm) closeOverlay(overlayConfirm); });
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
      if(dayTasks.length > 0) cell.classList.add('has-tasks');
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

  function handlePendingAgendaNavigation(){
    const pendingDate = localStorage.getItem(AGENDA_PENDING_DATE_KEY);
    if(!pendingDate) return;
    selectedDay = pendingDate;
    calCursor = new Date(`${pendingDate}T00:00:00`);
    renderCalendar();
    renderDayDetail(selectedDay);
    localStorage.removeItem(AGENDA_PENDING_DATE_KEY);
    localStorage.removeItem(AGENDA_PENDING_TASK_KEY);
    if(window.location.pathname.includes('/pages/agenda.html') || window.location.pathname.endsWith('/agenda.html')){
      setTimeout(()=>{
        if(localStorage.getItem(CHAT_PENDING_KEY)){
          window.location.href = `${getBasePath()}chat.html`;
        }
      }, 950);
    }
  }

  // ---------- INICIALIZAÇÃO ----------
  renderTodayPill();
  renderTaskList();
  renderCalendar();
  renderDayDetail(selectedDay);
  handlePendingAgendaNavigation();

  // ---------- NAVEGAÇÃO DO CALENDÁRIO ----------
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');
  if(calPrev){
    calPrev.addEventListener('click', ()=>{
      calCursor.setMonth(calCursor.getMonth() - 1);
      renderCalendar();
    });
  }
  if(calNext){
    calNext.addEventListener('click', ()=>{
      calCursor.setMonth(calCursor.getMonth() + 1);
      renderCalendar();
    });
  }

// Função para salvar a delegação de tarefas de forma dinâmica
window.saveDelegation = function(id, iso) {
  const input = document.getElementById(`delegate-input-${id}`);
  const name = input.value.trim();
  const task = tasks.find(t => t.id === id);
  if (task) {
    task.delegatedTo = name || null; // Atualiza o responsável no array
    saveTasks();
    renderCalendar();
    renderDayDetail(iso);
  }
};

// Função para apagar tarefas diretamente pela lista
window.deleteTaskInline = function(id, iso) {
  if (confirm("Tem certeza que deseja apagar este compromisso?")) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
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

  saveTasks();
  renderCalendar();
  renderDayDetail(iso);
};
})();