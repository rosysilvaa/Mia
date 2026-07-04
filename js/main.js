// ============================================================================
// MODIFICAÇÃO: Renderização detalhada com IA, Delegação e CRUD
// ============================================================================

// Função auxiliar para gerar sugestões da MIA com base na categoria da tarefa
function getIASuggestion(task) {
  if (task.category === 'eu') {
    return `MIA diz: Esse é o seu momento. Não mude o horário por ninguém e lembre-se de respirar fundo. Que tal deixar as notificações em silêncio durante essa atividade? 🌿`;
  }
  if (task.category === 'trabalho') {
    return `MIA diz: Para "${task.title}", tente organizar o material ou o ambiente com 15 minutos de antecedência. Se puder adiantar um pequeno passo agora, seu dia será muito mais leve! 💼`;
  }
  if (task.category === 'familia') {
    return `MIA diz: Cuidar da rotina de casa e dos filhos exige muito. Tente quebrar essa tarefa em pequenos passos ou peça ajuda se puder. Você está indo super bem! 💛`;
  }
  return `MIA diz: Estou aqui para te apoiar no que você precisar para organizar este compromisso.`;
}

// Substitua completamente a sua função renderDayDetail por esta:
function renderDayDetail(iso) {
  const title = document.getElementById('day-detail-title');
  const { num, mes } = fmtDay(iso);
  const isToday = iso === todayISO();
  title.textContent = isToday ? 'Hoje' : `${num} de ${mes}`;

  const list = document.getElementById('day-detail-list');
  const dayTasks = tasks.filter(t => t.date === iso).sort((a, b) => a.time.localeCompare(b.time));
  
  list.innerHTML = dayTasks.length ? '' : `<p style="color:var(--ink-soft); font-size:13px;">Nenhum compromisso neste dia. Um respiro pra você. 🌿</p>`;

  dayTasks.forEach(t => {
    const card = document.createElement('div');
    card.className = `task-card-expanded ${t.category}`;
    
    // Verifica se a tarefa já possui alguém delegado
    const delegadoHtml = t.delegatedTo 
      ? `<div class="delegated-tag">👤 Responsável: <strong>${t.delegatedTo}</strong></div>` 
      : '';

    card.innerHTML = `
      <div class="task-main-info">
        <div class="task-time">
          <span class="day">${t.time.split(':')[0]}h</span>
          <span>${t.time.split(':')[1]}</span>
        </div>
        <div class="task-info">
          <h3>${t.title}</h3>
          <p>📍 Local: ${t.place || 'Não informado'}</p>
          <p>📅 Data: ${t.date.split('-').reverse().join('/')}</p>
          ${delegadoHtml}
        </div>
        <span class="badge ${t.category}">${CATEGORY_LABEL[t.category]}</span>
      </div>
      
      <div class="task-ia-block">
        <p class="ia-text">${getIASuggestion(t)}</p>
      </div>

      <div class="task-delegate-row">
        <input type="text" id="delegate-input-${t.id}" placeholder="Se você não puder fazer, quem vai fazer?" value="${t.delegatedTo || ''}">
        <button class="btn-delegate-save" onclick="saveDelegation(${t.id}, '${iso}')">Delegar</button>
      </div>

      <div class="task-actions-row">
        <button class="btn-action-edit" onclick="editTaskInline(${t.id}, '${iso}')">✏️ Editar</button>
        <button class="btn-action-delete" onclick="deleteTaskInline(${t.id}, '${iso}')">🗑️ Apagar</button>
      </div>
    `;
    list.appendChild(card);
  });
}

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