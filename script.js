(function(){
  // ---------- ESTADO ----------
  const CATEGORY_LABEL = { eu:'Eu', familia:'Família', trabalho:'Trabalho' };
  const todayISO = () => new Date().toISOString().slice(0,10);

  const toISO = (d) => {
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off*60000);
    return local.toISOString().slice(0,10);
  };
  const addDays = (n) => { const d = new Date(); d.setDate(d.getDate()+n); return toISO(d); };

  let tasks = [
    { id:1, title:'Reunião com a coordenação', category:'trabalho', date:todayISO(), time:'09:30', place:'Escritório' },
    { id:2, title:'Escola — reunião de pais', category:'familia', date:addDays(1), time:'14:00', place:'Colégio do Ana' },
    { id:3, title:'Consulta médica', category:'eu', date:addDays(2), time:'10:15', place:'Clínica Bem Estar' },
    { id:4, title:'Aniversário da tia Rosa', category:'familia', date:addDays(4), time:'19:00', place:'Casa da tia Rosa' },
    { id:5, title:'Entrega do relatório mensal', category:'trabalho', date:addDays(5), time:'18:00', place:'Online' },
    { id:6, title:'Ioga — 30 minutos pra mim', category:'eu', date:addDays(6), time:'07:00', place:'Em casa' },
  ];
  let nextId = 7;
  let showingAll = false;
  let selectedCat = 'eu';
  let calCursor = new Date();
  let selectedDay = todayISO();

  // ---------- DATA NO HEADER ----------
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const diasSemana = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  function renderTodayPill(){
    const d = new Date();
    document.getElementById('today-pill').textContent =
      `${diasSemana[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
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
    list.innerHTML = '';
    const ordered = sortedTasks();
    document.getElementById('task-count').textContent = `${ordered.length} no total`;
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
    verMaisBtn.style.display = ordered.length > 3 ? 'block' : 'none';
    verMaisBtn.textContent = showingAll ? 'Ver menos' : 'Ver mais';
  }

  document.getElementById('ver-mais-btn').addEventListener('click', ()=>{
    showingAll = !showingAll;
    renderTaskList();
  });

  // ---------- MODAL: NOVA TAREFA ----------
  const overlayAdd = document.getElementById('overlay-add');
  document.getElementById('btn-add-task').addEventListener('click', ()=>{
    document.getElementById('new-date').value = todayISO();
    overlayAdd.classList.add('open');
  });
  document.getElementById('cancel-add').addEventListener('click', ()=> overlayAdd.classList.remove('open'));
  overlayAdd.addEventListener('click', (e)=>{ if(e.target === overlayAdd) overlayAdd.classList.remove('open'); });

  document.querySelectorAll('.cat-opt').forEach(opt=>{
    opt.addEventListener('click', ()=>{
      document.querySelectorAll('.cat-opt').forEach(o=>o.classList.remove('active'));
      opt.classList.add('active');
      selectedCat = opt.dataset.cat;
    });
  });

  document.getElementById('confirm-add').addEventListener('click', ()=>{
    const title = document.getElementById('new-title').value.trim();
    const date = document.getElementById('new-date').value || todayISO();
    const time = document.getElementById('new-time').value || '09:00';
    if(!title){ document.getElementById('new-title').focus(); return; }
    tasks.push({ id:nextId++, title, category:selectedCat, date, time, place:'' });
    document.getElementById('new-title').value = '';
    overlayAdd.classList.remove('open');
    renderTaskList();
    renderCalendar();
    renderDayDetail(selectedDay);
  });

  // ---------- MODAL: EMERGÊNCIA ----------
  const overlayEmg = document.getElementById('overlay-emergency');
  function openEmergency(){ overlayEmg.classList.add('open'); }
  document.getElementById('btn-emergency').addEventListener('click', openEmergency);
  document.getElementById('btn-emergency-2').addEventListener('click', openEmergency);
  document.getElementById('close-emergency').addEventListener('click', ()=> overlayEmg.classList.remove('open'));
  overlayEmg.addEventListener('click', (e)=>{ if(e.target === overlayEmg) overlayEmg.classList.remove('open'); });
  document.getElementById('emg-contact').addEventListener('click', ()=>{
    alert('Em um app completo, isso ligaria diretamente para o seu contato de confiança salvo.');
  });

  // ---------- NAVEGAÇÃO (TAB BAR) ----------
  const screens = {
    home: document.getElementById('screen-home'),
    agenda: document.getElementById('screen-agenda'),
    chat: document.getElementById('screen-chat'),
  };
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      Object.entries(screens).forEach(([key, el])=>{
        el.classList.toggle('active', key === btn.dataset.screen);
        el.style.display = key === btn.dataset.screen ? 'flex' : 'none';
      });
    });
  });

  // ---------- CALENDÁRIO ----------
  function renderCalendar(){
    const label = document.getElementById('cal-month-label');
    label.textContent = `${meses[calCursor.getMonth()]} de ${calCursor.getFullYear()}`;

    const grid = document.getElementById('cal-days');
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
    const { num, mes } = fmtDay(iso);
    const isToday = iso === todayISO();
    title.textContent = isToday ? 'Hoje' : `${num} de ${mes}`;
    const list = document.getElementById('day-detail-list');
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

  document.getElementById('cal-prev').addEventListener('click', ()=>{
    calCursor.setMonth(calCursor.getMonth()-1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', ()=>{
    calCursor.setMonth(calCursor.getMonth()+1);
    renderCalendar();
  });

  // ---------- CHAT COM A MIA ----------
  const chatBody = document.getElementById('chat-body');

  function addMessage(text, who){
    const el = document.createElement('div');
    el.className = `msg ${who}`;
    el.textContent = text;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function showTyping(){
    const el = document.createElement('div');
    el.className = 'typing';
    el.id = 'typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  }
  function hideTyping(){
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

  document.getElementById('chat-send').addEventListener('click', ()=>{
    const input = document.getElementById('chat-input');
    sendChat(input.value);
    input.value = '';
  });
  document.getElementById('chat-input').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){
      sendChat(e.target.value);
      e.target.value = '';
    }
  });

  // busca/pergunta na home também conversa com a MIA (leva pro chat)
  function goToChatWithMessage(text){
    document.querySelector('.tab-btn[data-screen="chat"]').click();
    if(text && text.trim()) setTimeout(()=> sendChat(text), 150);
  }
  document.getElementById('home-send').addEventListener('click', ()=>{
    const input = document.getElementById('home-search');
    goToChatWithMessage(input.value);
    input.value = '';
  });
  document.getElementById('home-search').addEventListener('keydown', (e)=>{
    if(e.key === 'Enter'){ goToChatWithMessage(e.target.value); e.target.value=''; }
  });

  // microfone (simulação de escuta)
  function wireMic(btnId, inputId){
    const btn = document.getElementById(btnId);
    btn.addEventListener('click', ()=>{
      btn.classList.add('mic-active');
      const input = document.getElementById(inputId);
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
  addMessage('Oi, Juliana. Eu sou a MIA — estou aqui pra te ajudar a organizar o dia e, principalmente, pra te ouvir. Como você está agora?', 'mia');
})();