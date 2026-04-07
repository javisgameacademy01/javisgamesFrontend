/* ===============================
   HELPERS
================================ */

function abrirModal() {
  const modal = document.getElementById("leadModal");
  if (modal) modal.style.display = "flex";
}

function fecharModal() {
  const modal = document.getElementById("leadModal");
  if (modal) modal.style.display = "none";
}

/* ===============================
   MODAL – ABRIR / FECHAR
================================ */

const modal = document.getElementById("leadModal");
const btnAbrirModal = document.getElementById("btn-modal-trigger");
const btnFecharModal = document.querySelector(".close-modal");

if (btnAbrirModal) {
  btnAbrirModal.addEventListener("click", (e) => {
    e.preventDefault();
    abrirModal();
    setTimeout(() => document.getElementById("nome")?.focus(), 150);
  });
}

if (btnFecharModal) {
  btnFecharModal.addEventListener("click", fecharModal);
}

window.addEventListener("click", (e) => {
  if (e.target === modal) fecharModal();
});

/* ===============================
   ELEMENTOS DO FORM
================================ */

const form = document.getElementById("leadForm");
const nomeInput = document.getElementById("nome");
const whatsappInput = document.getElementById("whatsapp");
const convidadosInput = document.getElementById("convidados");
const pacoteSelect = document.getElementById("pacote");
const cidadeSelect = document.getElementById("cidade");
const numeroHint = document.getElementById("numeroHint");

/* ===============================
   TELEFONES POR CIDADE
================================ */

const TELEFONES = {
  cuiaba: { wa: "5565992532020", label: "(65) 99253-2020" },
  teresina: { wa: "5586994318273", label: "(86) 99431-8273" },
};

function getTelefoneAtual() {
  const cidade = (cidadeSelect?.value || "cuiaba").toLowerCase();
  return TELEFONES[cidade] || TELEFONES.cuiaba;
}

function atualizarHintCidade() {
  const info = getTelefoneAtual();
  if (numeroHint) {
    numeroHint.innerHTML = `Atendimento WhatsApp: <strong>${info.label}</strong>`;
  }
}

if (cidadeSelect) {
  cidadeSelect.addEventListener("change", atualizarHintCidade);
  atualizarHintCidade(); // inicial
}

/* ===============================
   MÁSCARA WHATSAPP (BR)
   (99) 99999-9999
================================ */

function aplicarMascaraWhats(valor) {
  const digits = (valor || "").replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

if (whatsappInput) {
  whatsappInput.addEventListener("input", (e) => {
    const cursorEnd = e.target.selectionEnd;
    const masked = aplicarMascaraWhats(e.target.value);
    e.target.value = masked;

    // tentativa simples de manter cursor no fim (bom o suficiente)
    try {
      e.target.setSelectionRange(cursorEnd, cursorEnd);
    } catch {}
  });
}

/* ===============================
   BOTÕES DE PACOTES (cards)
   Abre modal e seleciona pacote
================================ */

document.querySelectorAll("[data-pacote]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const pacote = btn.getAttribute("data-pacote") || "";

    abrirModal();

    if (pacoteSelect) pacoteSelect.value = pacote;

    setTimeout(() => {
      nomeInput?.focus();
    }, 200);
  });
});

/* ===============================
   BOTÃO "VER PACOTES" (Hall Exclusive)
================================ */

const btnVerPacotes = document.getElementById("btn-ver-pacotes");
const secaoPacotes = document.querySelector(".packages-v2");

if (btnVerPacotes && secaoPacotes) {
  btnVerPacotes.addEventListener("click", () => {
    secaoPacotes.scrollIntoView({ behavior: "smooth", block: "start" });

    // “pulse” sutil no bloco de pacotes
    secaoPacotes.classList.add("pulse-focus");
    setTimeout(() => secaoPacotes.classList.remove("pulse-focus"), 900);
  });
}

/* ===============================
   ANIMAÇÃO DOS NÚMEROS (STATS)
   0 → 100 / 2 / +80
================================ */

function animateCount(el) {
  const target = Number(el.getAttribute("data-count") || "0");
  const prefix = el.getAttribute("data-prefix") || "";
  const duration = 900;

  const startTime = performance.now();
  const startValue = 0;

  function step(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
    const value = Math.round(startValue + (target - startValue) * eased);

    el.textContent = `${prefix}${value}`;

    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function setupStatsAnimation() {
  const grids = document.querySelectorAll('[data-animate="stats"]');
  if (!grids.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const grid = entry.target;
        if (grid.dataset.done === "1") return;

        grid.dataset.done = "1";
        grid.querySelectorAll(".stat-number").forEach(animateCount);

        observer.unobserve(grid);
      });
    },
    { threshold: 0.35 }
  );

  grids.forEach((g) => observer.observe(g));
}

setupStatsAnimation();

/* ===============================
   SUBMIT DO FORM
================================ */

function enviarLead(e) {
  e.preventDefault();

  const nome = (nomeInput?.value || "").trim();
  const whatsapp = (whatsappInput?.value || "").trim();
  const convidados = (convidadosInput?.value || "").trim();
  const pacote = (pacoteSelect?.value || "").trim();
  const cidade = (cidadeSelect?.value || "").trim();

  if (!cidade || !nome || !whatsapp || !pacote) {
    alert("Preencha: Cidade, Nome, WhatsApp e Pacote.");
    return;
  }

  const servico = document.title.split("|")[0].trim();
  const tel = getTelefoneAtual().wa;

  // mensagem
  let msg = `Olá! Me chamo *${nome}* 👋\n`;
  msg += `Quero um orçamento para *${servico}* 🎮\n`;
  msg += `📍 Cidade: *${cidade}*\n`;
  msg += `📱 Meu WhatsApp: *${whatsapp}*\n`;
  msg += `🎁 Pacote: *${pacote}*\n`;

  if (convidados) msg += `👥 Convidados: *${convidados}*\n`;

  msg += `\nPode me passar valores e detalhes, por favor? 😊`;

  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  fecharModal();
}

// garante submit funcionando mesmo sem onsubmit no HTML
if (form) {
  form.addEventListener("submit", enviarLead);
}

// também expõe (caso você use onsubmit="enviarLead(event)")
window.enviarLead = enviarLead;
