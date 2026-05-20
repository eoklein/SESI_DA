const currentDate = document.getElementById('current-date');
const currentCode = document.getElementById('current-code');
const materialsBody = document.getElementById('materials-body');
const addMaterialButton = document.getElementById('add-material');
const subtotalLabel = document.getElementById('subtotal-label');
const taxLabel = document.getElementById('tax-label');
const totalLabel = document.getElementById('total-label');
const totalItemsLabel = document.getElementById('total-items');
const discountInput = document.getElementById('discount');
const shippingInput = document.getElementById('shipping');
const budgetStatusSelect = document.getElementById('budget-status');
const savedBudgetsBody = document.getElementById('saved-budgets-body');
const saveBudgetButton = document.getElementById('save-budget');
const newBudgetButton = document.getElementById('new-budget');
const printBudgetButton = document.getElementById('print-budget');
const whatsappButton = document.getElementById('whatsapp-budget');
const newBudgetLink = document.getElementById('new-budget-link');
const toast = document.getElementById('toast');
const pdfTemplate = document.getElementById('pdf-template');
const pdfBudgetCode = document.getElementById('pdf-budget-code');
const pdfDate = document.getElementById('pdf-date');
const pdfClient = document.getElementById('pdf-client');
const pdfAddress = document.getElementById('pdf-address');
const pdfMaterials = document.getElementById('pdf-materials');
const pdfSubtotal = document.getElementById('pdf-subtotal');
const pdfDiscount = document.getElementById('pdf-discount');
const pdfShipping = document.getElementById('pdf-shipping');
const pdfTotal = document.getElementById('pdf-total');
const pdfNotes = document.getElementById('pdf-notes');

const STORAGE_KEY = 'orcamentos_cimento';
const STATUS_STEPS = ['Rascunho', 'Enviado', 'Aprovado', 'Recusado'];
const MATERIAL_OPTIONS = [
  { value: 'Cimento', label: 'Cimento', unitValue: 39.9 },
  { value: 'Areia', label: 'Areia', unitValue: 120.0 },
  { value: 'Brita', label: 'Brita', unitValue: 150.0 },
  { value: 'Argamassa', label: 'Argamassa', unitValue: 28.5 }
];

let budgets = [];
let currentBudgetId = null;
let nextRowId = 1;

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('pt-BR');
}

function generateId() {
  return `BUD-${Date.now().toString().slice(-6)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => toast.classList.remove('show'), 2500);
}

function getStorage() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function setStorage(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getInputValue(id) {
  return document.getElementById(id).value.trim();
}

function setInputValue(id, value) {
  document.getElementById(id).value = value || '';
}

function createMaterialRow(data = {}) {
  const rowId = nextRowId++;
  const row = document.createElement('tr');
  row.dataset.id = rowId;
  const product = data.product || 'Cimento';
  const quantity = Number(data.quantity || 1);
  const defaultValue = MATERIAL_OPTIONS.find((item) => item.value === product)?.unitValue || 39.9;
  const unitValue = Number(data.unitValue || defaultValue);

  row.innerHTML = `
    <td data-label="Produto">
      <select class="row-product">
        ${MATERIAL_OPTIONS.map((option) => `<option value="${option.value}" ${option.value === product ? 'selected' : ''}>${option.label}</option>`).join('')}
      </select>
    </td>
    <td data-label="Quantidade"><input type="number" min="1" class="row-quantity" value="${quantity}" /></td>
    <td data-label="Valor Unit."><input type="number" min="0" step="0.01" class="row-unit" value="${unitValue.toFixed(2)}" /></td>
    <td data-label="Total"><strong class="row-total">${formatCurrency(quantity * unitValue)}</strong></td>
    <td data-label="Ações"><button class="action-btn row-remove">Remover</button></td>
  `;

  materialsBody.appendChild(row);

  const quantityInput = row.querySelector('.row-quantity');
  const unitInput = row.querySelector('.row-unit');
  const productInput = row.querySelector('.row-product');
  const rowTotal = row.querySelector('.row-total');
  const removeButton = row.querySelector('.row-remove');

  function updateRowTotal() {
    const q = Number(quantityInput.value) || 0;
    const u = Number(unitInput.value) || 0;
    rowTotal.textContent = formatCurrency(q * u);
    updateTotals();
  }

  [quantityInput, unitInput].forEach((input) => {
    input.addEventListener('input', updateRowTotal);
  });

  productInput.addEventListener('change', () => {
    const selected = MATERIAL_OPTIONS.find((item) => item.value === productInput.value);
    if (selected) {
      unitInput.value = selected.unitValue.toFixed(2);
    }
    updateRowTotal();
  });

  removeButton.addEventListener('click', () => {
    row.remove();
    updateTotals();
  });
}

function getBudgetItems() {
  return Array.from(materialsBody.querySelectorAll('tr')).map((row) => ({
    product: row.querySelector('.row-product').value,
    quantity: Number(row.querySelector('.row-quantity').value) || 0,
    unitValue: Number(row.querySelector('.row-unit').value) || 0,
    total: Number(row.querySelector('.row-quantity').value) * Number(row.querySelector('.row-unit').value)
  }));
}

function updateTotals() {
  const items = getBudgetItems();
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const discountRate = Number(discountInput.value) || 0;
  const shipping = Number(shippingInput.value) || 0;
  const discountValue = (subtotal * discountRate) / 100;
  const taxes = (subtotal - discountValue) * 0.085;
  const total = subtotal - discountValue + taxes + shipping;

  subtotalLabel.textContent = formatCurrency(subtotal);
  taxLabel.textContent = formatCurrency(taxes);
  totalLabel.textContent = formatCurrency(total);
  totalItemsLabel.textContent = formatNumber(totalItems);
  updateMetrics(total);

  return { subtotal, discountValue, taxes, shipping, total, totalItems };
}

function validateBudget() {
  const name = getInputValue('client-name');
  const phone = getInputValue('client-phone');
  const address = getInputValue('client-address');
  const city = getInputValue('client-city');
  const validity = getInputValue('validity-terms');
  const items = getBudgetItems();

  if (!name) return 'Informe o nome do cliente.';
  if (!phone || phone.length < 10) return 'Informe um telefone válido.';
  if (!address) return 'Informe o endereço da obra.';
  if (!city) return 'Informe a cidade.';
  if (!validity) return 'Informe o prazo de validade do orçamento.';
  if (!items.length) return 'Adicione ao menos um material.';
  if (items.some((item) => !item.product || item.quantity <= 0 || item.unitValue <= 0)) {
    return 'Verifique os itens: todos devem ter produto, quantidade e valor unitário válidos.';
  }

  return null;
}

function getFormBudget() {
  const items = getBudgetItems();
  const totals = updateTotals();
  const today = new Date().toISOString().slice(0, 10);

  return {
    id: currentBudgetId || generateId(),
    code: currentCode.textContent.replace('Orçamento ', '').trim(),
    cliente: getInputValue('client-name'),
    empresa: getInputValue('client-company'),
    cpfCnpj: getInputValue('client-tax'),
    telefone: getInputValue('client-phone'),
    email: getInputValue('client-email'),
    endereco: getInputValue('client-address'),
    cidade: getInputValue('client-city'),
    cep: getInputValue('client-zipcode'),
    data: today,
    validade: getInputValue('validity-terms'),
    materias: items,
    subtotal: totals.subtotal,
    desconto: Number(discountInput.value) || 0,
    impostos: totals.taxes,
    frete: totals.shipping,
    total: totals.total,
    observacoes: getInputValue('general-notes'),
    pagamento: getInputValue('payment-terms'),
    prazo: getInputValue('deadline-terms'),
    notasEntrega: getInputValue('delivery-notes'),
    status: budgetStatusSelect.value,
    updatedAt: new Date().toISOString()
  };
}

function setFormBudget(budget) {
  currentBudgetId = budget.id;
  currentCode.textContent = `Orçamento ${budget.code}`;
  currentDate.textContent = new Date(budget.data).toLocaleDateString('pt-BR');
  setInputValue('client-name', budget.cliente);
  setInputValue('client-company', budget.empresa);
  setInputValue('client-tax', budget.cpfCnpj);
  setInputValue('client-phone', budget.telefone);
  setInputValue('client-email', budget.email);
  setInputValue('client-address', budget.endereco);
  setInputValue('client-city', budget.cidade);
  setInputValue('client-zipcode', budget.cep);
  setInputValue('validity-terms', budget.validade);
  setInputValue('payment-terms', budget.pagamento);
  setInputValue('deadline-terms', budget.prazo);
  setInputValue('delivery-notes', budget.notasEntrega);
  setInputValue('general-notes', budget.observacoes);
  discountInput.value = budget.desconto || 0;
  shippingInput.value = budget.frete || 0;
  budgetStatusSelect.value = budget.status || 'Rascunho';
  materialsBody.innerHTML = '';
  (budget.materias || budget.materiais || []).forEach((item) => createMaterialRow(item));
  updateTotals();
}

function resetBudget() {
  currentBudgetId = null;
  currentCode.textContent = `Orçamento ${generateId()}`;
  currentDate.textContent = new Date().toLocaleDateString('pt-BR');
  setInputValue('client-name', '');
  setInputValue('client-company', '');
  setInputValue('client-tax', '');
  setInputValue('client-phone', '');
  setInputValue('client-email', '');
  setInputValue('client-address', '');
  setInputValue('client-city', '');
  setInputValue('client-zipcode', '');
  setInputValue('validity-terms', '15 dias');
  setInputValue('payment-terms', '50% na aprovação, 50% na entrega.');
  setInputValue('deadline-terms', 'Entrega em até 7 dias úteis.');
  setInputValue('delivery-notes', 'Verificar necessidade de içamento no local.');
  setInputValue('general-notes', 'Orçamento válido por 15 dias.');
  discountInput.value = 0;
  shippingInput.value = 120;
  budgetStatusSelect.value = 'Rascunho';
  materialsBody.innerHTML = '';
  createMaterialRow({ product: 'Cimento', quantity: 1, unitValue: 39.9 });
  updateTotals();
}

function renderBudgetRow(budget) {
  const row = document.createElement('tr');
  row.innerHTML = `
    <td data-label="Código">${budget.code}</td>
    <td data-label="Cliente">${budget.cliente}</td>
    <td data-label="Total">${formatCurrency(budget.total)}</td>
    <td data-label="Status"><span class="status-chip ${budget.status}">${budget.status}</span></td>
    <td data-label="Ações">
      <button class="action-btn" data-action="edit" data-id="${budget.id}">Editar</button>
      <button class="action-btn" data-action="delete" data-id="${budget.id}">Excluir</button>
      <button class="action-btn" data-action="pdf" data-id="${budget.id}">PDF</button>
      <button class="action-btn" data-action="whatsapp" data-id="${budget.id}">WhatsApp</button>
    </td>
  `;
  return row;
}

function renderSavedBudgets() {
  savedBudgetsBody.innerHTML = '';
  budgets.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).forEach((budget) => {
    savedBudgetsBody.appendChild(renderBudgetRow(budget));
  });
}

function updateMetrics(currentTotal) {
  const totalValue = budgets.reduce((sum, item) => sum + (item.total || 0), 0);
  const clients = [...new Set(budgets.map((item) => item.cliente))].filter(Boolean).length;
  const approved = budgets.filter((item) => item.status === 'Aprovado').length;
  const displayValue = typeof currentTotal === 'number' && currentTotal > 0 ? currentTotal : totalValue;
  document.getElementById('metric-count').textContent = budgets.length;
  document.getElementById('metric-value').textContent = formatCurrency(displayValue);
  document.getElementById('metric-clients').textContent = clients;
  document.getElementById('metric-approved').textContent = approved;
}

function saveCurrentBudget() {
  const error = validateBudget();
  if (error) {
    showToast(error);
    return;
  }

  const budget = getFormBudget();
  const index = budgets.findIndex((item) => item.id === budget.id);

  if (index >= 0) {
    budgets[index] = budget;
    showToast('Orçamento atualizado com sucesso.');
  } else {
    budgets.push(budget);
    showToast('Orçamento salvo com sucesso.');
  }

  setStorage(budgets);
  renderSavedBudgets();
  updateMetrics();
}

function loadBudgetById(id) {
  const budget = budgets.find((item) => item.id === id);
  if (!budget) return;
  setFormBudget(budget);
  showToast('Orçamento carregado para edição.');
}

function deleteBudget(id) {
  if (!confirm('Deseja realmente excluir este orçamento?')) return;
  budgets = budgets.filter((item) => item.id !== id);
  setStorage(budgets);
  renderSavedBudgets();
  updateMetrics();
  resetBudget();
  showToast('Orçamento excluído.');
}

function buildWhatsappMessage(budget) {
  const total = formatCurrency(budget.total);
  const itemsText = (budget.materias || budget.materiais || []).map((item) => `- ${item.product} x${item.quantity} (${formatCurrency(item.unitValue)})`).join('%0A');
  return `Olá ${budget.cliente},%0A%0AEste é o seu orçamento de materiais.%0A%0A${itemsText}%0A%0ATotal: ${total}%0A%0AObrigado.`;
}

function openWhatsapp(budget) {
  const message = buildWhatsappMessage(budget);
  window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
}

function generatePdf(budget) {
  pdfBudgetCode.textContent = budget.code;
  pdfDate.textContent = `Data: ${new Date(budget.data).toLocaleDateString('pt-BR')}`;
  pdfClient.innerHTML = `<strong>${budget.cliente}</strong> | ${budget.empresa || 'Empresa não informada'}`;
  pdfAddress.innerHTML = `${budget.endereco}, ${budget.cidade} - ${budget.cep}`;
  pdfNotes.textContent = budget.observacoes || 'Nenhuma observação adicional.';

  pdfMaterials.innerHTML = `
    <thead>
      <tr>
        <th>Produto</th>
        <th>Quantidade</th>
        <th>Valor Unit.</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${(budget.materias || budget.materiais || []).map((item) => `
        <tr>
          <td>${item.product}</td>
          <td>${item.quantity}</td>
          <td>${formatCurrency(item.unitValue)}</td>
          <td>${formatCurrency(item.total)}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  pdfSubtotal.textContent = formatCurrency(budget.subtotal);
  pdfDiscount.textContent = `${budget.desconto}%`;
  pdfShipping.textContent = formatCurrency(budget.frete);
  pdfTotal.textContent = formatCurrency(budget.total);

  const options = {
    margin: 0.4,
    filename: `${budget.code}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(options).from(pdfTemplate).save();
}

function handleSavedActions(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const action = button.dataset.action;
  const id = button.dataset.id;
  if (!action || !id) return;

  if (action === 'edit') loadBudgetById(id);
  if (action === 'delete') deleteBudget(id);
  if (action === 'pdf') {
    const budget = budgets.find((item) => item.id === id);
    if (budget) generatePdf(budget);
  }
  if (action === 'whatsapp') {
    const budget = budgets.find((item) => item.id === id);
    if (budget) openWhatsapp(budget);
  }
}

function initializePage() {
  budgets = getStorage();
  renderSavedBudgets();
  updateMetrics();
  resetBudget();
  currentDate.textContent = new Date().toLocaleDateString('pt-BR');
}

addMaterialButton.addEventListener('click', () => {
  createMaterialRow({ product: 'Cimento', quantity: 1, unitValue: 39.9 });
  updateTotals();
});

discountInput.addEventListener('input', updateTotals);
shippingInput.addEventListener('input', updateTotals);
budgetStatusSelect.addEventListener('change', () => {});
saveBudgetButton.addEventListener('click', saveCurrentBudget);
newBudgetButton.addEventListener('click', resetBudget);
newBudgetLink.addEventListener('click', (event) => {
  event.preventDefault();
  resetBudget();
});
printBudgetButton.addEventListener('click', () => {
  const budget = getFormBudget();
  generatePdf(budget);
});
whatsappButton.addEventListener('click', () => {
  const budget = getFormBudget();
  openWhatsapp(budget);
});
savedBudgetsBody.addEventListener('click', handleSavedActions);

initializePage();
