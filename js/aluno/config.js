// ==========================================
// js/aluno/config.js (Configurações Globais)
// ==========================================

const API_URL = 'https://javisgamesbackend.onrender.com';
const API_BASE = API_URL; // Usado no suporte.js
const API_URL_GLOBAL = API_URL; // Usado no navbar.js

// Verifica se o aluno está logado
function getTokenOrRedirect() {
  const token = localStorage.getItem('access_token');
  if (!token) {
    window.location.href = "IndexHome.html";
    return null;
  }
  return token;
}

// Faz requisições GET padrão
async function apiGet(path, token) {
  const resp = await fetch(`${API_URL}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (resp.status === 401) {
    localStorage.removeItem('access_token');
    alert("Sua sessão expirou. Por favor, faça login novamente.");
    window.location.href = "IndexHome.html"; 
    return null;
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
  }
  return resp.json();
}

// Faz requisições POST/PUT padrão
async function apiSend(path, method, token, bodyObj) {
  const resp = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: bodyObj ? JSON.stringify(bodyObj) : undefined
  });

  if (resp.status === 401) {
    localStorage.removeItem('access_token');
    alert("Sua sessão expirou. Por favor, faça login novamente.");
    window.location.href = "IndexHome.html";
    return null;
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`API ${resp.status}: ${txt || resp.statusText}`);
  }
  const text = await resp.text().catch(() => '');
  return text ? JSON.parse(text) : {};
}