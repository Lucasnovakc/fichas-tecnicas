// Configurações: logo, nome do restaurante, categorias e backup (exportar/importar).
(function () {
  const { estado, F, R, DB } = App;
  const esc = R.esc;

  async function abrir(tela) {
    const c = estado.config;
    await App.carregarUrls([c.logo]);
    const u = App.urlFoto(c.logo);
    tela.innerHTML = `<div class="tela-config config">
      <section class="painel"><h2>Logo e nome</h2>
        <div class="foto-campo logo-campo">
          ${u ? `<img src="${esc(u)}" alt="Logo">` : '<div class="foto-vazia">sem logo</div>'}
          <label class="btn">${u ? 'Trocar logo' : 'Enviar logo'}<input type="file" accept="image/*" hidden data-logo></label>
          ${u ? '<button type="button" class="btn" data-acao="rmlogo">Remover</button>' : ''}
        </div>
        <label class="campo"><span>Nome do restaurante (rodapé da ficha)</span><input id="nome-rest" value="${esc(c.nomeRestaurante)}"></label>
      </section>
      <section class="painel"><h2>Categorias</h2>
        <ul class="cats">
          ${c.categorias.map((cat, i) => `<li>
            <input data-cat="${i}" value="${esc(cat)}">
            <span class="uso">${F.contarUsoCategoria(estado.fichas, cat)} ficha(s)</span>
            <button type="button" class="btn mini perigo" data-acao="cat-del" data-i="${i}" title="Remover">✕</button>
          </li>`).join('') || '<li class="vazio">Nenhuma categoria ainda.</li>'}
        </ul>
        <div class="linha"><input id="nova-cat" placeholder="ex: SALADAS"><button type="button" class="btn primario" data-acao="cat-add">Adicionar</button></div>
      </section>
      <section class="painel"><h2>Backup</h2>
        <p class="vazio">Guarda todas as fichas e fotos num arquivo. Use para não perder nada ou para levar para outro computador.</p>
        <div class="barra">
          <button type="button" class="btn primario" data-acao="exportar">Exportar backup</button>
          <label class="btn">Importar backup<input type="file" accept=".json,application/json" hidden data-importar></label>
        </div>
      </section>
    </div>`;
  }

  const redesenhar = () => abrir(document.getElementById('tela'));
  const salvarConfig = () => DB.salvarConfig(estado.config);

  async function adicionarCategoria() {
    const input = document.getElementById('nova-cat');
    const r = F.adicionarCategoria(estado.config.categorias, input.value);
    if (!r.ok) { App.toast(r.erro, 'erro'); return; }
    estado.config.categorias = r.categorias;
    await salvarConfig();
    await redesenhar();
    document.getElementById('nova-cat').focus();
  }

  const blobParaDataUrl = blob => new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(leitor.result);
    leitor.onerror = () => falha(leitor.error);
    leitor.readAsDataURL(blob);
  });

  function dataUrlParaBlob(dataUrl) {
    const [cabecalho, dados] = dataUrl.split(',');
    const tipo = cabecalho.slice(5).split(';')[0];
    const bin = atob(dados);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  async function montarBackup() {
    const fotos = {};
    for (const id of await DB.listarIdsFotos()) {
      const blob = await DB.lerFoto(id);
      if (blob) fotos[id] = await blobParaDataUrl(blob);
    }
    return {
      app: 'ficha-tecnica', versao: F.VERSAO_BACKUP, exportadoEm: new Date().toISOString(),
      // cópia fixa do momento do backup (não a lista viva do app)
      config: JSON.parse(JSON.stringify(estado.config)), fichas: JSON.parse(JSON.stringify(estado.fichas)), fotos,
    };
  }

  async function exportarBackup() {
    const dados = await montarBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(dados)], { type: 'application/json' }));
    a.download = `fichas-tecnicas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    App.toast('Backup exportado.');
  }

  async function importarArquivo(arquivo) {
    let obj;
    try { obj = JSON.parse(await arquivo.text()); }
    catch { App.toast('Arquivo inválido: não é um backup.', 'erro'); return; }
    const v = F.validarBackup(obj);
    if (!v.ok) { App.toast(v.erro, 'erro'); return; }
    const modo = await App.escolher(`Backup com ${obj.fichas.length} ficha(s). O que fazer?`, [
      ['substituir', 'Substituir tudo', 'perigo'],
      ['juntar', 'Juntar com as atuais', 'primario'],
      ['', 'Cancelar'],
    ]);
    if (!modo) return;
    // Tudo é preparado antes de tocar no banco; a gravação é uma transação só.
    let fotos;
    try { fotos = Object.entries(obj.fotos).map(([id, dataUrl]) => [id, dataUrlParaBlob(dataUrl)]); }
    catch { App.toast('Backup com foto corrompida — nada foi alterado.', 'erro'); return; }
    const importado = {
      config: {
        ...F.CONFIG_PADRAO,
        ...obj.config,
        nomeRestaurante: String(obj.config.nomeRestaurante || F.CONFIG_PADRAO.nomeRestaurante),
        categorias: obj.config.categorias.map(String),
        logo: typeof obj.config.logo === 'string' ? obj.config.logo : null,
      },
      fichas: obj.fichas.map(F.normalizarFicha),
    };
    const final = modo === 'substituir'
      ? importado
      : F.juntarBackup({ config: estado.config, fichas: estado.fichas }, importado);
    try {
      await DB.gravarImportacao({ limpar: modo === 'substituir', config: final.config, fichas: importado.fichas, fotos });
    } catch (err) {
      console.error(err);
      App.toast('Não foi possível importar o backup — nada foi alterado.', 'erro');
      return;
    }
    try {
      estado.config = final.config;
      estado.fichas = final.fichas.slice();
      App.esquecerUrls();
      await App.limparFotosOrfas();
      App.toast('Backup importado.');
      if (document.querySelector('.tela-config')) await redesenhar();
    } catch (err) {
      App.erro(err);
    }
  }

  document.addEventListener('change', async e => {
    const t = e.target;
    if (!t.closest('.tela-config')) return;
    const c = estado.config;
    if (t.id === 'nome-rest') {
      c.nomeRestaurante = t.value.trim() || F.CONFIG_PADRAO.nomeRestaurante;
      await salvarConfig();
      App.toast('Nome salvo.');
    } else if (t.dataset.cat !== undefined) {
      const antigo = c.categorias[+t.dataset.cat];
      if (t.value.trim() === antigo) return;
      const r = F.renomearCategoria(c.categorias, estado.fichas, antigo, t.value);
      if (!r.ok) { App.toast(r.erro, 'erro'); t.value = antigo; return; }
      c.categorias = r.categorias;
      await salvarConfig();
      for (const f of r.fichasAlteradas) await App.salvarFicha(f);
      App.toast('Categoria renomeada.');
      await redesenhar();
    } else if (t.dataset.logo !== undefined && t.files.length) {
      try { c.logo = await App.guardarFoto(t.files[0], { lado: 600, tipo: 'image/png' }); }
      catch { App.toast('Não foi possível ler essa imagem.', 'erro'); return; }
      await salvarConfig();
      await App.limparFotosOrfas();
      await redesenhar();
    } else if (t.dataset.importar !== undefined && t.files.length) {
      const arquivo = t.files[0];
      t.value = '';
      await importarArquivo(arquivo);
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'nova-cat') { e.preventDefault(); adicionarCategoria(); }
  });

  document.addEventListener('click', async e => {
    const b = e.target.closest('.tela-config [data-acao]');
    if (!b) return;
    const c = estado.config;
    switch (b.dataset.acao) {
      case 'cat-add':
        await adicionarCategoria();
        break;
      case 'cat-del': {
        const nome = c.categorias[+b.dataset.i];
        const uso = F.contarUsoCategoria(estado.fichas, nome);
        if (uso) { App.toast(`Não dá para remover: ${uso} ficha(s) usam "${nome}".`, 'erro'); return; }
        if (!confirm(`Remover a categoria "${nome}"?`)) return;
        c.categorias = c.categorias.filter(x => x !== nome);
        await salvarConfig();
        await redesenhar();
        break;
      }
      case 'rmlogo':
        c.logo = null;
        await salvarConfig();
        await App.limparFotosOrfas();
        await redesenhar();
        break;
      case 'exportar':
        await exportarBackup();
        break;
    }
  });

  App.registrarTela('config', abrir);
  window.Config = { montarBackup, importarArquivo };
})();
