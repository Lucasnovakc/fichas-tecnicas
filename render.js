// Monta o HTML da folha A4 a partir de uma ficha. Usado na prévia e na impressão.
(function () {
  const F = typeof module !== 'undefined' && module.exports ? require('./ficha.js') : window.Ficha;

  function esc(texto) {
    return String(texto == null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const ICONES = {
    fresco: svg('<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15"/><path d="M5 19l8-8"/>'),
    selecionados: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
    'na-hora': svg('<path d="M6 16a6 6 0 0 1 12 0z"/><path d="M4 19h16"/><path d="M12 10V7"/><path d="M10 7h4"/>'),
    padrao: svg('<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>'),
    picante: svg('<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 1 1 2 2 3 4z"/>'),
    vegetariano: svg('<path d="M12 21V11"/><path d="M12 11c0-4 3-7 7-7 0 4-3 7-7 7z"/><path d="M12 14c0-3-2-5-6-5 0 3 2 5 6 5z"/>'),
    'sem-gluten': svg('<path d="M12 21V6"/><path d="M12 9c-2 0-3-2-3-4 2 0 3 2 3 4zM12 9c2 0 3-2 3-4-2 0-3 2-3 4zM12 14c-2 0-3-2-3-4 2 0 3 2 3 4zM12 14c2 0 3-2 3-4-2 0-3 2-3 4z"/><path d="M4 4l16 16"/>'),
    rendimento: svg('<path d="M4 20h16"/><path d="M6 20l2-9h8l2 9"/><circle cx="12" cy="7" r="3"/>'),
    porcao: svg('<path d="M3 11h18a9 9 0 0 1-18 0z"/><path d="M8 7c0-2 2-2 2-4M13 7c0-2 2-2 2-4"/>'),
    tempo: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4"/>'),
    nivel: svg('<path d="M5 20v-4M10 20v-8M15 20V8M20 20V4"/>'),
    check: svg('<path d="M5 12l5 5 9-10"/>'),
  };

  function renderFolha(ficha, config, urlFoto) {
    const url = id => (id && urlFoto(id)) || null;
    const logo = url(config.logo);
    const imgLogo = logo ? `<img class="f-logo" src="${esc(logo)}" alt="">` : '';
    const foto = url(ficha.foto);
    const ingredientes = ficha.ingredientes.filter(i => i.nome.trim());
    const passos = ficha.passos.filter(p => p.texto.trim() || url(p.foto));
    const conferencias = ficha.conferencias.filter(c => c.trim());
    const selos = ficha.selos.map(ch => F.SELOS.find(s => s.chave === ch)).filter(Boolean);
    const info = [
      ['rendimento', 'Rendimento', ficha.rendimento],
      ['porcao', 'Porção', ficha.porcao],
      ['tempo', 'Tempo de montagem', ficha.tempo],
      ['nivel', 'Nível', F.DIFICULDADES[ficha.dificuldade] || ''],
    ];

    const htmlSelos = selos.length
      ? `<ul class="f-selos">${selos.map(s => `<li>${ICONES[s.chave]}<span>${esc(s.nome)}</span></li>`).join('')}</ul>`
      : '';
    const htmlIngredientes = ingredientes.map((i, n) => `<li><span class="f-num">${n + 1}</span><span class="f-ing">${esc(i.nome)}${i.obs.trim() ? `<small>${esc(i.obs)}</small>` : ''}</span><span class="f-qtd">${esc(F.formatarQuantidade(i.quantidade, i.unidade))}</span></li>`).join('');
    const htmlPassos = passos.map((p, n) => {
      const u = url(p.foto);
      return `<div class="f-passo${u ? '' : ' so-texto'}"><span class="f-num">${n + 1}</span>${u ? `<img src="${esc(u)}" alt="">` : ''}<p>${esc(p.texto)}</p></div>`;
    }).join('');

    return `<article class="folha">
  <header class="f-topo">
    <div class="f-marca">${imgLogo}<div>
      <div class="f-categoria">${esc(ficha.categoria)}</div>
      <div class="f-sub">FICHA TÉCNICA DE MONTAGEM</div>
      <div class="f-lema">PADRÃO • QUALIDADE • SABOR</div>
    </div></div>
    <div class="f-titulo">
      ${ficha.codigo.trim() ? `<div class="f-codigo">CÓDIGO <b>${esc(ficha.codigo)}</b></div>` : ''}
      <h1 class="f-nome">${esc(ficha.nome)}</h1>
      ${htmlSelos}
    </div>
  </header>
  <section class="f-info">${info.map(([ic, rot, val]) => `<div>${ICONES[ic]}<span class="f-rot">${rot}</span><b>${esc(val) || '—'}</b></div>`).join('')}</section>
  <section class="f-meio${foto ? '' : ' sem-foto'}">
    <div class="f-ingredientes">
      <h2>INGREDIENTES${ficha.rendimento.trim() ? ' — ' + esc(ficha.rendimento) : ''}</h2>
      <ol>${htmlIngredientes}</ol>
    </div>
    ${foto ? `<div class="f-foto"><img src="${esc(foto)}" alt=""></div>` : ''}
  </section>
  ${passos.length ? `<section class="f-passos"><h2>PASSO A PASSO DA MONTAGEM <span>(ordem de montagem)</span></h2><div class="f-grade">${htmlPassos}</div></section>` : ''}
  <section class="f-final">
    ${conferencias.length ? `<div class="f-conf"><h2>PONTOS DE CONFERÊNCIA</h2><ul>${conferencias.map(c => `<li>${ICONES.check}<span>${esc(c)}</span></li>`).join('')}</ul></div>` : ''}
    ${ficha.observacoes.trim() ? `<div class="f-obs"><h2>OBSERVAÇÕES</h2><p>${esc(ficha.observacoes)}</p></div>` : ''}
  </section>
  <footer class="f-rodape">${imgLogo}<span>${esc(config.nomeRestaurante)}</span></footer>
</article>`;
  }

  // Reduz a letra da folha (e, com ela, tudo que usa em) até o conteúdo caber na altura A4.
  function ajustarFolha(folha) {
    for (let p = 100; p >= 70; p -= 5) {
      folha.style.fontSize = +(11 * p / 100).toFixed(2) + 'pt';
      if (folha.scrollHeight <= folha.clientHeight + 1) return true;
    }
    return false;
  }

  const api = { esc, renderFolha, ajustarFolha, ICONES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Render = api;
})();
