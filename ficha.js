// Regras puras da ficha técnica — sem DOM e sem IndexedDB (testáveis com node).
(function () {
  const SELOS = [
    { chave: 'fresco', nome: 'Fresco' },
    { chave: 'selecionados', nome: 'Ingredientes selecionados' },
    { chave: 'na-hora', nome: 'Feito na hora' },
    { chave: 'padrao', nome: 'Padrão da casa' },
    { chave: 'picante', nome: 'Picante' },
    { chave: 'vegetariano', nome: 'Vegetariano' },
    { chave: 'sem-gluten', nome: 'Sem glúten' },
  ];
  const MAX_SELOS = 4;
  const UNIDADES = ['g', 'kg', 'ml', 'L', 'un'];
  const DIFICULDADES = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
  const VERSAO_BACKUP = 1;
  const CONFIG_PADRAO = { nomeRestaurante: 'Barão Restaurante Bar', categorias: [], logo: null };

  function gerarId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function novaFicha(categoria) {
    return {
      id: gerarId(),
      categoria: categoria || '',
      codigo: '',
      nome: '',
      selos: [],
      rendimento: '',
      porcao: '',
      tempo: '',
      dificuldade: 'facil',
      foto: null,
      fotoAjuste: null,
      ingredientes: [{ nome: '', quantidade: null, unidade: 'g', obs: '' }],
      passos: [{ texto: '', foto: null }],
      conferencias: [''],
      observacoes: '',
      atualizadoEm: Date.now(),
    };
  }

  function duplicarFicha(ficha) {
    const copia = JSON.parse(JSON.stringify(ficha));
    copia.id = gerarId();
    copia.nome = (ficha.nome ? ficha.nome + ' ' : '') + '(cópia)';
    copia.codigo = '';
    copia.atualizadoEm = Date.now();
    return copia;
  }

  // Aceita "1,5", "1.5", e ponto de milhar brasileiro: "1.500" e "1.500,5".
  function parseQuantidade(texto) {
    let s = String(texto == null ? '' : texto).trim();
    if (s === '') return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function formatarQuantidade(qtd, unidade) {
    if (qtd === null || qtd === undefined || qtd === '' || !Number.isFinite(Number(qtd))) return '';
    let q = Number(qtd);
    let u = unidade;
    if (u === 'g' && q >= 1000) { q /= 1000; u = 'kg'; }
    else if (u === 'ml' && q >= 1000) { q /= 1000; u = 'L'; }
    return String(Math.round(q * 100) / 100).replace('.', ',') + ' ' + u;
  }

  function chaveCodigo(codigo) {
    return String(codigo || '').replace(/\s+/g, '').toUpperCase();
  }

  function codigoDuplicado(fichas, ficha) {
    const k = chaveCodigo(ficha.codigo);
    if (!k) return false;
    return fichas.some(f => f.id !== ficha.id && chaveCodigo(f.codigo) === k);
  }

  function buscarFichas(fichas, texto, categoria) {
    const t = normalizar(texto);
    return fichas
      .filter(f => !categoria || f.categoria === categoria)
      .filter(f => !t || normalizar(f.nome).includes(t) || normalizar(f.codigo).includes(t))
      .sort((a, b) =>
        a.categoria.localeCompare(b.categoria, 'pt') ||
        a.codigo.localeCompare(b.codigo, 'pt', { numeric: true }) ||
        a.nome.localeCompare(b.nome, 'pt'));
  }

  function alternarSelo(selos, chave) {
    if (selos.includes(chave)) return selos.filter(s => s !== chave);
    if (selos.length >= MAX_SELOS) return selos;
    return [...selos, chave];
  }

  function moverItem(lista, indice, direcao) {
    const nova = lista.slice();
    const j = indice + direcao;
    if (j < 0 || j >= lista.length) return nova;
    [nova[indice], nova[j]] = [nova[j], nova[indice]];
    return nova;
  }

  function fotosDaFicha(ficha) {
    return [ficha.foto, ...ficha.passos.map(p => p.foto)].filter(Boolean);
  }

  function fotosOrfas(fichas, idsFotos, protegidos) {
    const usadas = new Set((protegidos || []).filter(Boolean));
    fichas.forEach(f => fotosDaFicha(f).forEach(id => usadas.add(id)));
    return idsFotos.filter(id => !usadas.has(id));
  }

  function adicionarCategoria(categorias, nome) {
    const n = String(nome || '').trim();
    if (!n) return { ok: false, erro: 'Digite o nome da categoria.' };
    if (categorias.some(c => normalizar(c) === normalizar(n))) return { ok: false, erro: 'Essa categoria já existe.' };
    return { ok: true, categorias: [...categorias, n] };
  }

  function renomearCategoria(categorias, fichas, antigo, novo) {
    const n = String(novo || '').trim();
    if (!n) return { ok: false, erro: 'Digite o nome da categoria.' };
    if (categorias.some(c => c !== antigo && normalizar(c) === normalizar(n))) return { ok: false, erro: 'Essa categoria já existe.' };
    return {
      ok: true,
      categorias: categorias.map(c => (c === antigo ? n : c)),
      fichasAlteradas: fichas.filter(f => f.categoria === antigo).map(f => ({ ...f, categoria: n })),
    };
  }

  function contarUsoCategoria(fichas, nome) {
    return fichas.filter(f => f.categoria === nome).length;
  }

  function validarBackup(obj) {
    const erro = e => ({ ok: false, erro: e });
    if (!obj || typeof obj !== 'object' || obj.app !== 'ficha-tecnica') return erro('Este arquivo não é um backup de fichas técnicas.');
    if (obj.versao !== VERSAO_BACKUP) return erro('Versão de backup não suportada.');
    if (!obj.config || !Array.isArray(obj.config.categorias)) return erro('Backup sem configurações válidas.');
    if (!Array.isArray(obj.fichas)) return erro('Backup sem lista de fichas.');
    const fichaValida = f => f && typeof f.id === 'string' && typeof f.nome === 'string' &&
      Array.isArray(f.ingredientes) && Array.isArray(f.passos) && Array.isArray(f.conferencias);
    if (!obj.fichas.every(fichaValida)) return erro('Backup com ficha inválida.');
    if (!obj.fotos || typeof obj.fotos !== 'object' || Array.isArray(obj.fotos)) return erro('Backup sem fotos válidas.');
    if (!Object.values(obj.fotos).every(v => typeof v === 'string' && v.startsWith('data:image/'))) return erro('Backup com foto inválida.');
    return { ok: true };
  }

  // Enquadramento de uma foto: ponto de foco x/y (0–100%), zoom (1–3) ou foto inteira (sem cortar).
  function normalizarAjuste(a) {
    const num = (v, min, max, padrao, casas) => {
      const n = Number(v);
      if (v === null || v === undefined || v === '' || !Number.isFinite(n)) return padrao;
      const f = 10 ** casas;
      return Math.round(Math.min(max, Math.max(min, n)) * f) / f;
    };
    const o = a && typeof a === 'object' ? a : {};
    return { x: num(o.x, 0, 100, 50, 1), y: num(o.y, 0, 100, 50, 1), zoom: num(o.zoom, 1, 3, 1, 2), inteira: !!o.inteira };
  }

  function estiloFoto(ajuste) {
    const a = normalizarAjuste(ajuste);
    if (a.inteira) return 'object-fit:contain';
    const pos = `${a.x}% ${a.y}%`;
    return `object-fit:cover;object-position:${pos}` + (a.zoom > 1 ? `;transform:scale(${a.zoom});transform-origin:${pos}` : '');
  }

  // Garante todos os campos com o tipo certo (fichas vindas de backup podem estar incompletas).
  function normalizarFicha(obj) {
    const txt = v => (v == null ? '' : String(v));
    const base = novaFicha('');
    const lista = v => (Array.isArray(v) ? v : []);
    return {
      id: txt(obj.id) || base.id,
      categoria: txt(obj.categoria),
      codigo: txt(obj.codigo),
      nome: txt(obj.nome),
      selos: lista(obj.selos).filter(s => SELOS.some(x => x.chave === s)).slice(0, MAX_SELOS),
      rendimento: txt(obj.rendimento),
      porcao: txt(obj.porcao),
      tempo: txt(obj.tempo),
      dificuldade: DIFICULDADES[obj.dificuldade] ? obj.dificuldade : 'facil',
      foto: typeof obj.foto === 'string' && obj.foto ? obj.foto : null,
      fotoAjuste: obj.fotoAjuste ? normalizarAjuste(obj.fotoAjuste) : null,
      ingredientes: lista(obj.ingredientes).map(i => ({
        nome: txt(i && i.nome),
        quantidade: i && Number.isFinite(i.quantidade) && i.quantidade >= 0 ? i.quantidade : null,
        unidade: i && UNIDADES.includes(i.unidade) ? i.unidade : 'g',
        obs: txt(i && i.obs),
      })),
      passos: lista(obj.passos).map(p => ({
        texto: txt(p && p.texto),
        foto: p && typeof p.foto === 'string' && p.foto ? p.foto : null,
        ...(p && p.ajuste ? { ajuste: normalizarAjuste(p.ajuste) } : {}),
      })),
      conferencias: lista(obj.conferencias).map(txt),
      observacoes: txt(obj.observacoes),
      atualizadoEm: Number.isFinite(obj.atualizadoEm) ? obj.atualizadoEm : Date.now(),
    };
  }

  function juntarBackup(atual, importado) {
    const categorias = atual.config.categorias.slice();
    importado.config.categorias.forEach(c => {
      if (!categorias.some(x => normalizar(x) === normalizar(c))) categorias.push(c);
    });
    const idsImportados = new Set(importado.fichas.map(f => f.id));
    return {
      config: { ...atual.config, categorias },
      fichas: [...atual.fichas.filter(f => !idsImportados.has(f.id)), ...importado.fichas],
    };
  }

  const api = {
    SELOS, MAX_SELOS, UNIDADES, DIFICULDADES, VERSAO_BACKUP, CONFIG_PADRAO,
    gerarId, normalizar, novaFicha, duplicarFicha, parseQuantidade, formatarQuantidade,
    codigoDuplicado, buscarFichas, alternarSelo, moverItem, fotosDaFicha, fotosOrfas,
    adicionarCategoria, renomearCategoria, contarUsoCategoria, validarBackup, normalizarFicha, normalizarAjuste, estiloFoto, juntarBackup,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.Ficha = api;
})();
