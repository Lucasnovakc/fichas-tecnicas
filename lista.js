// Tela inicial: lista de fichas com busca, filtro por categoria e ações.
(function () {
  const { estado, F, R, DB } = App;
  const esc = R.esc;
  const filtros = { busca: '', categoria: '' };

  async function abrir(tela) {
    const cats = estado.config.categorias;
    if (filtros.categoria && !cats.includes(filtros.categoria)) filtros.categoria = '';
    tela.innerHTML = `<div class="tela-lista">
      ${estado.dbOk ? '' : '<div class="aviso erro">Este navegador não deixa salvar dados aqui — as fichas NÃO serão guardadas.</div>'}
      <div class="barra">
        <input id="busca" type="search" placeholder="Buscar por nome ou código" value="${esc(filtros.busca)}">
        <select id="filtro"><option value="">Todas as categorias</option>${cats.map(c => `<option value="${esc(c)}" ${c === filtros.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
        <button type="button" class="btn primario" data-acao="nova">+ Nova ficha</button>
      </div>
      <div id="cards" class="cards"></div>
    </div>`;
    await desenharCards();
  }

  async function desenharCards() {
    await App.carregarUrls(estado.fichas.map(f => f.foto));
    const el = document.getElementById('cards');
    if (!el) return;
    const lista = F.buscarFichas(estado.fichas, filtros.busca, filtros.categoria);
    if (!estado.fichas.length) {
      el.innerHTML = '<p class="vazio">Nenhuma ficha ainda. Clique em <b>+ Nova ficha</b> para começar.</p>';
      return;
    }
    if (!lista.length) {
      el.innerHTML = '<p class="vazio">Nenhuma ficha encontrada.</p>';
      return;
    }
    el.innerHTML = lista.map(f => {
      const u = App.urlFoto(f.foto);
      return `<div class="card">
        <div class="card-foto">${u ? `<img src="${esc(u)}" alt="">` : '<span>sem foto</span>'}</div>
        <div class="card-corpo">
          <div class="card-cat">${esc(f.categoria)}</div>
          <div class="card-cod">${esc(f.codigo)}</div>
          <div class="card-nome">${esc(f.nome || '(sem nome)')}</div>
          <div class="card-acoes">
            <button type="button" class="btn" data-acao="editar" data-id="${esc(f.id)}">Editar</button>
            <button type="button" class="btn" data-acao="duplicar" data-id="${esc(f.id)}">Duplicar</button>
            <button type="button" class="btn" data-acao="imprimir" data-id="${esc(f.id)}">Imprimir</button>
            <button type="button" class="btn perigo" data-acao="excluir" data-id="${esc(f.id)}">Excluir</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  document.addEventListener('input', e => {
    if (e.target.id === 'busca') { filtros.busca = e.target.value; desenharCards(); }
    if (e.target.id === 'filtro') { filtros.categoria = e.target.value; desenharCards(); }
  });

  document.addEventListener('click', async e => {
    const b = e.target.closest('.tela-lista [data-acao]');
    if (!b) return;
    const ficha = estado.fichas.find(f => f.id === b.dataset.id);
    switch (b.dataset.acao) {
      case 'nova': {
        const nova = F.novaFicha(estado.config.categorias[0] || '');
        await App.salvarFicha(nova);
        await App.ir('editor', nova);
        break;
      }
      case 'editar':
        await App.ir('editor', ficha);
        break;
      case 'duplicar':
        await App.salvarFicha(F.duplicarFicha(ficha));
        await desenharCards();
        App.toast('Ficha duplicada.');
        break;
      case 'imprimir':
        await App.imprimir(ficha);
        break;
      case 'excluir':
        if (!confirm(`Excluir a ficha "${ficha.nome || ficha.codigo || 'sem nome'}"? Isso não pode ser desfeito.`)) return;
        await DB.excluirFicha(ficha.id);
        estado.fichas.splice(estado.fichas.indexOf(ficha), 1);
        await App.limparFotosOrfas();
        await desenharCards();
        App.toast('Ficha excluída.');
        break;
    }
  });

  App.registrarTela('lista', abrir);
})();
