// Editor da ficha: formulário à esquerda, prévia A4 ao vivo à direita.
// Digitação só altera os dados e a prévia; o formulário é redesenhado apenas em mudanças de estrutura
// (adicionar/remover/mover itens, fotos) para não tirar o foco do campo.
(function () {
  const { estado, F, R } = App;
  const esc = R.esc;
  let ficha = null;
  let timerSalvar = null;
  let timerPrevia = null;

  const NOVOS = {
    ingredientes: () => ({ nome: '', quantidade: null, unidade: 'g', obs: '' }),
    passos: () => ({ texto: '', foto: null }),
    conferencias: () => '',
  };

  async function abrir(tela, f) {
    ficha = f;
    tela.innerHTML = `<div class="tela-editor editor">
      <div class="editor-form">
        <div class="barra">
          <button type="button" class="btn" data-acao="voltar">← Voltar</button>
          <span class="salvo" id="salvo">Salvo ✓</span>
          <button type="button" class="btn primario" data-acao="imprimir">Imprimir</button>
        </div>
        <div id="aviso-codigo" class="aviso alerta" hidden>Já existe outra ficha com esse código.</div>
        <div id="aviso-pagina" class="aviso erro" hidden>Esta ficha passou de 1 página — reduza passos ou textos.</div>
        <form id="form" autocomplete="off"></form>
      </div>
      <div class="editor-previa"><div id="previa" class="previa"></div></div>
    </div>`;
    desenharForm();
    checarCodigo();
    App.aoSair(sair);
    await atualizarPrevia();
  }

  async function sair() {
    clearTimeout(timerSalvar);
    clearTimeout(timerPrevia);
    const f = ficha;
    ficha = null;
    await App.salvarFicha(f);
  }

  const campo = (rotulo, html) => `<label class="campo"><span>${rotulo}</span>${html}</label>`;
  const texto = (nome, valor, dica) => `<input data-campo="${nome}" value="${esc(valor)}" placeholder="${esc(dica)}">`;

  function blocoFoto(id, attrs) {
    const u = App.urlFoto(id);
    return `<div class="foto-campo">
      ${u ? `<img src="${esc(u)}" alt="">` : '<div class="foto-vazia">sem foto</div>'}
      <label class="btn">${u ? 'Trocar foto' : 'Enviar foto'}<input type="file" accept="image/*" hidden ${attrs}></label>
      ${u ? `<button type="button" class="btn" data-acao="rmfoto" ${attrs}>Remover</button>` : ''}
    </div>`;
  }

  function botoesItem(lista, i, total) {
    return `<div class="item-acoes">
      <button type="button" class="btn mini" data-acao="up" data-lista="${lista}" data-i="${i}" ${i === 0 ? 'disabled' : ''} title="Subir">↑</button>
      <button type="button" class="btn mini" data-acao="down" data-lista="${lista}" data-i="${i}" ${i === total - 1 ? 'disabled' : ''} title="Descer">↓</button>
      <button type="button" class="btn mini perigo" data-acao="del" data-lista="${lista}" data-i="${i}" title="Remover">✕</button>
    </div>`;
  }

  function desenharForm() {
    const f = ficha;
    const cats = estado.config.categorias;
    const opcoesCat = (f.categoria && !cats.includes(f.categoria) ? [f.categoria, ...cats] : cats)
      .map(c => `<option value="${esc(c)}" ${c === f.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('');
    const quantidade = q => (q == null ? '' : String(q).replace('.', ','));

    document.getElementById('form').innerHTML = `
      <fieldset><legend>Identificação</legend>
        ${cats.length ? '' : '<p class="dica">Dica: cadastre categorias em <b>Configurações</b>.</p>'}
        <div class="linha">
          ${campo('Categoria', `<select data-campo="categoria"><option value="">—</option>${opcoesCat}</select>`)}
          ${campo('Código', texto('codigo', f.codigo, 'ex: LS-S-006'))}
        </div>
        ${campo('Nome do prato', texto('nome', f.nome, 'ex: Montagem Caesar'))}
        <div class="selos-opcoes"><span>Selos (até ${F.MAX_SELOS})</span>
          ${F.SELOS.map(s => `<label class="chk"><input type="checkbox" data-selo="${s.chave}" ${f.selos.includes(s.chave) ? 'checked' : ''}>${esc(s.nome)}</label>`).join('')}
        </div>
      </fieldset>
      <fieldset><legend>Informações</legend>
        <div class="linha">
          ${campo('Rendimento', texto('rendimento', f.rendimento, 'ex: 1 unidade (850 g)'))}
          ${campo('Porção', texto('porcao', f.porcao, 'ex: 850 g'))}
        </div>
        <div class="linha">
          ${campo('Tempo de montagem', texto('tempo', f.tempo, 'ex: 3 a 5 minutos'))}
          ${campo('Dificuldade', `<select data-campo="dificuldade">${Object.entries(F.DIFICULDADES).map(([k, v]) => `<option value="${k}" ${f.dificuldade === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        </div>
        <div class="campo"><span>Foto do prato pronto</span>${blocoFoto(f.foto, 'data-foto="principal"')}</div>
      </fieldset>
      <fieldset><legend>Ingredientes</legend>
        ${f.ingredientes.map((ing, i) => `<div class="item item-ing">
          <input data-lista="ingredientes" data-i="${i}" data-prop="nome" value="${esc(ing.nome)}" placeholder="Ingrediente">
          <input data-lista="ingredientes" data-i="${i}" data-prop="quantidade" value="${esc(quantidade(ing.quantidade))}" placeholder="Qtd" inputmode="decimal">
          <select data-lista="ingredientes" data-i="${i}" data-prop="unidade">${F.UNIDADES.map(u => `<option value="${u}" ${ing.unidade === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
          ${botoesItem('ingredientes', i, f.ingredientes.length)}
          <input class="obs" data-lista="ingredientes" data-i="${i}" data-prop="obs" value="${esc(ing.obs)}" placeholder="Observação (sai em vermelho) — opcional">
        </div>`).join('')}
        <button type="button" class="btn" data-acao="add" data-lista="ingredientes">+ Ingrediente</button>
      </fieldset>
      <fieldset><legend>Passo a passo</legend>
        ${f.passos.map((p, i) => `<div class="item item-passo">
          <span class="num">${i + 1}</span>
          <textarea data-lista="passos" data-i="${i}" data-prop="texto" rows="2" placeholder="Descreva o passo">${esc(p.texto)}</textarea>
          ${botoesItem('passos', i, f.passos.length)}
          ${blocoFoto(p.foto, `data-foto="passo" data-i="${i}"`)}
        </div>`).join('')}
        <button type="button" class="btn" data-acao="add" data-lista="passos">+ Passo</button>
      </fieldset>
      <fieldset><legend>Pontos de conferência</legend>
        ${f.conferencias.map((c, i) => `<div class="item">
          <input data-lista="conferencias" data-i="${i}" value="${esc(c)}" placeholder="ex: Peso final conferido: 850 g">
          ${botoesItem('conferencias', i, f.conferencias.length)}
        </div>`).join('')}
        <button type="button" class="btn" data-acao="add" data-lista="conferencias">+ Conferência</button>
      </fieldset>
      <fieldset><legend>Observações</legend>
        <textarea data-campo="observacoes" rows="3" placeholder="Opcional">${esc(f.observacoes)}</textarea>
      </fieldset>`;
  }

  const marcarSalvo = t => { const el = document.getElementById('salvo'); if (el) el.textContent = t; };

  function alterou() {
    ficha.atualizadoEm = Date.now();
    marcarSalvo('Salvando…');
    const f = ficha;
    clearTimeout(timerSalvar);
    timerSalvar = setTimeout(() => {
      timerSalvar = null;
      App.salvarFicha(f).then(() => marcarSalvo('Salvo ✓'), err => { marcarSalvo('Erro ao salvar'); App.erro(err); });
    }, 500);
    clearTimeout(timerPrevia);
    timerPrevia = setTimeout(atualizarPrevia, 200);
  }

  async function atualizarPrevia() {
    if (!ficha) return;
    await App.carregarUrls([estado.config.logo, ...F.fotosDaFicha(ficha)]);
    const previa = document.getElementById('previa');
    if (!previa || !ficha) return;
    previa.innerHTML = R.renderFolha(ficha, estado.config, App.urlFoto);
    document.getElementById('aviso-pagina').hidden = R.ajustarFolha(previa.firstElementChild);
  }

  function checarCodigo() {
    document.getElementById('aviso-codigo').hidden = !F.codigoDuplicado(estado.fichas, ficha);
  }

  document.addEventListener('input', e => {
    const t = e.target;
    if (!ficha || !t.closest('#form')) return;
    if (t.dataset.campo) {
      ficha[t.dataset.campo] = t.value;
      if (t.dataset.campo === 'codigo') checarCodigo();
    } else if (t.dataset.lista) {
      const lista = ficha[t.dataset.lista];
      const i = +t.dataset.i;
      if (t.dataset.lista === 'conferencias') lista[i] = t.value;
      else if (t.dataset.prop === 'quantidade') {
        lista[i].quantidade = F.parseQuantidade(t.value);
        t.classList.toggle('invalido', t.value.trim() !== '' && lista[i].quantidade === null);
      } else lista[i][t.dataset.prop] = t.value;
    } else return;
    alterou();
  });

  // Fechar/recarregar a página com salvamento pendente: o IndexedDB pode não terminar a tempo,
  // então guarda uma cópia síncrona no localStorage, que o app aplica ao abrir (App.PENDENTE).
  function salvarPendente() {
    if (!ficha || !timerSalvar) return;
    clearTimeout(timerSalvar);
    timerSalvar = null;
    try { localStorage.setItem(App.PENDENTE, JSON.stringify(ficha)); } catch {}
    App.salvarFicha(ficha);
  }
  window.addEventListener('pagehide', salvarPendente);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') salvarPendente(); });

  document.addEventListener('change', async e => {
    const t = e.target;
    if (!ficha || !t.closest('#form')) return;
    if (t.dataset.selo) {
      const novos = F.alternarSelo(ficha.selos, t.dataset.selo);
      if (novos === ficha.selos) {
        t.checked = false;
        App.toast(`Escolha no máximo ${F.MAX_SELOS} selos.`, 'erro');
        return;
      }
      ficha.selos = novos;
      alterou();
      return;
    }
    if (t.type === 'file' && t.files && t.files.length) {
      // Guarda o destino antes de esperar: durante o envio o passo pode ser movido/apagado
      // ou o usuário pode sair do editor.
      const alvo = ficha;
      const passo = t.dataset.foto === 'passo' ? ficha.passos[+t.dataset.i] : null;
      let id;
      try { id = await App.guardarFoto(t.files[0]); }
      catch { App.toast('Não foi possível ler essa imagem.', 'erro'); return; }
      if (passo) {
        if (!alvo.passos.includes(passo)) return; // passo apagado durante o envio
        passo.foto = id;
      } else {
        alvo.foto = id;
      }
      if (ficha === alvo) {
        desenharForm();
        alterou();
      } else {
        await App.salvarFicha(alvo);
      }
    }
  });

  document.addEventListener('click', async e => {
    const b = e.target.closest('.tela-editor [data-acao]');
    if (!b || !ficha) return;
    const lista = b.dataset.lista;
    const i = +b.dataset.i;
    switch (b.dataset.acao) {
      case 'voltar': await App.ir('lista'); return;
      case 'imprimir': await App.imprimir(ficha); return;
      case 'add': ficha[lista].push(NOVOS[lista]()); break;
      case 'del': ficha[lista].splice(i, 1); break;
      case 'up': ficha[lista] = F.moverItem(ficha[lista], i, -1); break;
      case 'down': ficha[lista] = F.moverItem(ficha[lista], i, 1); break;
      case 'rmfoto':
        if (b.dataset.foto === 'principal') ficha.foto = null;
        else ficha.passos[i].foto = null;
        break;
      default: return;
    }
    desenharForm();
    alterou();
    if (b.dataset.acao === 'add') {
      const novo = document.querySelector(`#form [data-lista="${lista}"][data-i="${ficha[lista].length - 1}"]`);
      if (novo) novo.focus();
    }
  });

  App.registrarTela('editor', abrir);
})();
