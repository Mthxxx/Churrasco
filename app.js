// ============================================
//   CHURRASCO DA COPA — app.js
//   Integração com Supabase
// ============================================

// ⚙️ CONFIGURAÇÃO SUPABASE — substitua com suas credenciais
const SUPABASE_URL = 'https://qwtbxciyjmwydnsyuiid.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_W5N6hjW5twJymcs3dJd6Dg_g4NsXQ-N';
const TABLE_NAME = 'convidados'; // nome da sua tabela no Supabase

// ============================================
//   SUPABASE HELPER (sem SDK — fetch puro)
// ============================================
async function insertGuest(payload) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Erro ao salvar no banco');
  }

  return true;
}

// ============================================
//   MÁSCARA DE CPF
// ============================================
function maskCPF(value) {
  return value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function cleanCPF(value) {
  return value.replace(/\D/g, '');
}

function applyMaskToInput(input) {
  input.addEventListener('input', () => {
    input.value = maskCPF(input.value);
  });
}

// Aplica máscara ao CPF principal
applyMaskToInput(document.getElementById('cpf'));

// ============================================
//   GERENCIAR ACOMPANHANTES
// ============================================
let acompanhanteCount = 0;
const container = document.getElementById('acompanhantes-container');

document.getElementById('btn-add-acomp').addEventListener('click', () => {
  acompanhanteCount++;
  const idx = acompanhanteCount;

  const block = document.createElement('div');
  block.classList.add('guest-block');
  block.id = `acomp-${idx}`;
  block.innerHTML = `
    <div class="guest-label">👥 Acompanhante ${idx}</div>
    <button class="btn-remove" onclick="removeAcomp(${idx})">✕ Remover</button>
    <div class="field">
      <label>Nome completo</label>
      <input type="text" id="nome-acomp-${idx}" placeholder="Nome do acompanhante" autocomplete="off"/>
    </div>
    <div class="field">
      <label>CPF</label>
      <input type="text" id="cpf-acomp-${idx}" placeholder="000.000.000-00" maxlength="14" autocomplete="off"/>
    </div>
  `;

  container.appendChild(block);
  applyMaskToInput(document.getElementById(`cpf-acomp-${idx}`));

  // Scroll suave até o novo bloco
  block.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

function removeAcomp(idx) {
  const block = document.getElementById(`acomp-${idx}`);
  if (block) block.remove();
}

// ============================================
//   VALIDAÇÃO
// ============================================
function validateCPF(cpf) {
  const raw = cleanCPF(cpf);
  if (raw.length !== 11) return false;
  if (/^(\d)\1+$/.test(raw)) return false; // sequências repetidas

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(raw[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  if (rest !== parseInt(raw[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(raw[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10 || rest === 11) rest = 0;
  return rest === parseInt(raw[10]);
}

// ============================================
//   FEEDBACK UI
// ============================================
function showFeedback(msg, type) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  el.className = `feedback ${type}`;
  el.style.display = 'block';
}

function hideFeedback() {
  const el = document.getElementById('feedback');
  el.style.display = 'none';
}

// ============================================
//   CONFIRMAR PRESENÇA
// ============================================
document.getElementById('btn-confirmar').addEventListener('click', async () => {
  hideFeedback();

  const nome = document.getElementById('nome').value.trim();
  const cpf = document.getElementById('cpf').value.trim();

  // Validações do convidado principal
  if (!nome) {
    showFeedback('⚠️ Preencha seu nome.', 'error');
    return;
  }
  if (!cpf) {
    showFeedback('⚠️ Preencha seu CPF.', 'error');
    return;
  }
  if (!validateCPF(cpf)) {
    showFeedback('⚠️ CPF inválido. Verifique e tente novamente.', 'error');
    return;
  }

  // Coleta acompanhantes
  const acompanhantes = [];
  const acompBlocks = container.querySelectorAll('.guest-block');

  for (const block of acompBlocks) {
    const idNum = block.id.replace('acomp-', '');
    const nomeAcomp = document.getElementById(`nome-acomp-${idNum}`)?.value.trim();
    const cpfAcomp = document.getElementById(`cpf-acomp-${idNum}`)?.value.trim();

    if (!nomeAcomp) {
      showFeedback(`⚠️ Preencha o nome do acompanhante ${idNum}.`, 'error');
      return;
    }
    if (!cpfAcomp) {
      showFeedback(`⚠️ Preencha o CPF do acompanhante ${idNum}.`, 'error');
      return;
    }
    if (!validateCPF(cpfAcomp)) {
      showFeedback(`⚠️ CPF do acompanhante ${idNum} é inválido.`, 'error');
      return;
    }

    acompanhantes.push({ nome: nomeAcomp, cpf: cleanCPF(cpfAcomp) });
  }

  // Loading
  showFeedback('⏳ Confirmando presença...', 'loading');
  const btnConfirmar = document.getElementById('btn-confirmar');
  btnConfirmar.disabled = true;

  try {
    // Salva convidado principal
    await insertGuest({
      nome: nome,
      cpf: cleanCPF(cpf),
      tipo: 'principal',
      acompanhante_de: null,
      criado_em: new Date().toISOString()
    });

    // Salva acompanhantes
    for (const a of acompanhantes) {
      await insertGuest({
        nome: a.nome,
        cpf: a.cpf,
        tipo: 'acompanhante',
        acompanhante_de: cleanCPF(cpf),
        criado_em: new Date().toISOString()
      });
    }

    // Sucesso
    showSuccess(nome, acompanhantes.length);

  } catch (err) {
    console.error(err);
    showFeedback(`❌ Erro: ${err.message}. Tente novamente.`, 'error');
    btnConfirmar.disabled = false;
  }
});

// ============================================
//   TELA DE SUCESSO
// ============================================
function showSuccess(nome, totalAcomp) {
  document.getElementById('form-card').style.display = 'none';
  const successCard = document.getElementById('success-card');
  successCard.style.display = 'block';

  const total = 1 + totalAcomp;
  const msg = totalAcomp > 0
    ? `${nome} + ${totalAcomp} acompanhante${totalAcomp > 1 ? 's' : ''} confirmado${totalAcomp > 1 ? 's' : ''}! Total: ${total} pessoa${total > 1 ? 's' : ''} na lista. 🎉`
    : `${nome}, você está na lista! Nos vemos lá 🎉`;

  document.getElementById('success-msg').textContent = msg;
  successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ============================================
//   RESETAR FORMULÁRIO
// ============================================
function resetForm() {
  document.getElementById('nome').value = '';
  document.getElementById('cpf').value = '';
  document.getElementById('acompanhantes-container').innerHTML = '';
  acompanhanteCount = 0;
  hideFeedback();
  document.getElementById('btn-confirmar').disabled = false;

  document.getElementById('success-card').style.display = 'none';
  document.getElementById('form-card').style.display = 'block';

  document.getElementById('cadastro').scrollIntoView({ behavior: 'smooth' });
}
