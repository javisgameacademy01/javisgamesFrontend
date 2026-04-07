// Modal
const modal = document.getElementById('leadModal');
const btnTrigger = document.getElementById('btn-modal-trigger');
const closeBtn = document.querySelector('.close-modal');
const leadForm = document.getElementById('leadForm');

// Pacote selecionado (default)
let selectedPackage = "Pacote Arena";

// Telefones por cidade
const whatsappPorCidade = {
  cuiaba: "5565992532020",
  teresina: "5586994318273"
};

// Abrir modal
btnTrigger.addEventListener('click', (e) => {
  e.preventDefault();
  modal.style.display = 'flex';
});

// Fechar modal
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Clique fora fecha
window.addEventListener('click', (e) => {
  if (e.target === modal) modal.style.display = 'none';
});

// Seletor de pacote (sidebar)
const pkgButtons = document.querySelectorAll('.pkg-btn');
pkgButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    pkgButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPackage = btn.getAttribute('data-package');
  });
});

// Submit do formulário
leadForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const nome = document.getElementById('nome').value.trim();
  const data = document.getElementById('data').value.trim();
  const cidade = document.getElementById('cidade').value;

  const numeroWhatsapp = whatsappPorCidade[cidade] || whatsappPorCidade.cuiaba;

  const servico = document.title.split('|')[0].trim();
  const cidadeLabel = cidade === 'teresina' ? 'Teresina' : 'Cuiabá';

  const texto =
    `Olá! Me chamo *${nome}*.\n` +
    `Tenho interesse no *${servico}* (${selectedPackage})` +
    `${data ? ` para *${data}*` : ''}.\n` +
    `Gostaria de saber valores e disponibilidade para *${cidadeLabel}*.`;

  window.open(`https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent(texto)}`, '_blank');
  modal.style.display = 'none';
});

// ===== Máscara automática para WhatsApp =====
const whatsappInput = document.getElementById('whatsapp');

whatsappInput.addEventListener('input', (e) => {
  let value = e.target.value.replace(/\D/g, '');

  if (value.length > 11) value = value.slice(0, 11);

  if (value.length >= 2) {
    value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
  }
  if (value.length >= 10) {
    value = value.replace(/(\(\d{2}\)\s\d{5})(\d+)/, '$1-$2');
  }

  e.target.value = value;
});
