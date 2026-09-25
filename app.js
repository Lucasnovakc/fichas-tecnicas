// Núcleo do app: estado, fotos, navegação entre telas, avisos e impressão.
(function () {
  const F = window.Ficha, R = window.Render, DB = window.DB;
  const estado = { fichas: [], config: { ...F.CONFIG_PADRAO, categorias: [] }, dbOk: true };
  const telas = {};
  const urls = new Map(); // id da foto → object URL
  let sairDaTela = null;

  function toast(msg, tipo) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast visivel' + (tipo ? ' ' + tipo : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { el.className = 'toast'; }, 4000);
  }

  // Caixa de escolha com botões. opcoes: [[valor, rótulo, classe?], ...]; Esc devolve null.
  function escolher(msg, opcoes) {
    const d = document.getElementById('dialogo');
    d.innerHTML = `<p>${R.esc(msg)}</p><div class="dialogo-botoes">${opcoes.map(([v, r, c]) => `<button type="button" class="btn ${c || ''}" value="${R.esc(v)}">${R.esc(r)}</button>`).join('')}</div>`;
    return new Promise(ok => {
      d.onclick = e => { const b = e.target.closest('button'); if (b) { d.close(); ok(b.value || null); } };
      d.oncancel = () => ok(null);
      d.showModal();
    });
  }

  async function carregarUrls(ids) {
    for (const id of ids) {
      if (!id || urls.has(id)) continue;
      const blob = await DB.lerFoto(id);
      if (blob) urls.set(id, URL.createObjectURL(blob));
    }
  }
  const urlFoto = id => urls.get(id) || null;
  function esquecerUrls() {
    urls.forEach(u => URL.revokeObjectURL(u));
    urls.clear();
  }

  async function reduzirImagem(arquivo, lado, tipo) {
    const img = await createImageBitmap(arquivo);
    const escala = Math.min(1, lado / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * escala);
    c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return new Promise((ok, falha) => c.toBlob(b => (b ? ok(b) : falha(new Error('Falha ao converter a imagem'))), tipo, 0.82));
  }

  async function guardarFoto(arquivo, opcoes = {}) {
    const blob = await reduzirImagem(arquivo, opcoes.lado || 1200, opcoes.tipo || 'image/jpeg');
    const id = F.gerarId();
    await DB.salvarFoto(id, blob);
    urls.set(id, URL.createObjectURL(blob));
    return id;
  }

  async function limparFotosOrfas() {
    const orfas = F.fotosOrfas(estado.fichas, await DB.listarIdsFotos(), [estado.config.logo]);
    for (const id of orfas) {
      await DB.excluirFoto(id);
      if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); }
    }
  }

  async function prepararImpressao(ficha) {
    await carregarUrls([estado.config.logo, ...F.fotosDaFicha(ficha)]);
    const area = document.getElementById('area-impressao');
    area.innerHTML = R.renderFolha(ficha, estado.config, urlFoto);
    const folha = area.firstElementChild;
    await Promise.all([...folha.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    return R.ajustarFolha(folha);
  }

  async function imprimir(ficha) {
    const coube = await prepararImpressao(ficha);
    if (coube) toast("Se sair sem cor, marque 'Gráficos de fundo' na janela de impressão.");
    else toast('Esta ficha passou de 1 página — reduza passos ou textos.', 'erro');
    window.print();
  }

  function registrarTela(nome, abrir) { telas[nome] = abrir; }
  function aoSair(fn) { sairDaTela = fn; }

  async function ir(nome, ...args) {
    if (sairDaTela) { const sair = sairDaTela; sairDaTela = null; await sair(); }
    document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('ativo', b.dataset.nav === nome));
    await telas[nome](document.getElementById('tela'), ...args);
  }

  async function salvarFicha(f) {
    await DB.salvarFicha(f);
    const i = estado.fichas.findIndex(x => x.id === f.id);
    if (i >= 0) estado.fichas[i] = f; else estado.fichas.push(f);
  }

  function erro(err) {
    console.error(err);
    toast('Algo deu errado: ' + ((err && err.message) || err), 'erro');
  }

  // Edição que estava esperando para salvar quando a página foi fechada (ver editor.js).
  const PENDENTE = 'ficha-tecnica:pendente';
  async function aplicarPendente() {
    let texto = null;
    try { texto = localStorage.getItem(PENDENTE); } catch {}
    if (!texto) return;
    try { await DB.salvarFicha(F.normalizarFicha(JSON.parse(texto))); }
    catch (err) { console.error(err); }
    try { localStorage.removeItem(PENDENTE); } catch {}
  }

  async function iniciar() {
    try {
      await DB.abrir();
      await aplicarPendente();
      estado.config = await DB.lerConfig();
      estado.fichas = await DB.listarFichas();
      await carregarUrls([estado.config.logo]);
      await limparFotosOrfas();
    } catch (err) {
      console.error(err);
      estado.dbOk = false;
    }
    await ir('lista');
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-nav]');
    if (b) ir(b.dataset.nav).catch(erro);
  });
  document.addEventListener('submit', e => e.preventDefault());
  window.addEventListener('unhandledrejection', e => erro(e.reason));
  document.addEventListener('DOMContentLoaded', () => iniciar().catch(erro));

  window.App = {
    estado, F, R, DB, toast, escolher, carregarUrls, urlFoto, esquecerUrls, guardarFoto,
    limparFotosOrfas, prepararImpressao, imprimir, registrarTela, ir, aoSair, salvarFicha, erro, PENDENTE,
  };
})();
