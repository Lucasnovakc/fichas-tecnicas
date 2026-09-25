// Persistência no IndexedDB do navegador: fichas, fotos (Blob) e configurações.
(function () {
  const NOME = 'ficha-tecnica';
  const VERSAO = 1;
  let conexao = null;

  function abrir() {
    if (!conexao) {
      conexao = new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('IndexedDB indisponível'));
        const req = indexedDB.open(NOME, VERSAO);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore('fichas', { keyPath: 'id' });
          db.createObjectStore('fotos');
          db.createObjectStore('config');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return conexao;
  }

  async function operar(store, modo, fn) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, modo);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  window.DB = {
    abrir,
    listarFichas: () => operar('fichas', 'readonly', s => s.getAll()),
    salvarFicha: f => operar('fichas', 'readwrite', s => s.put(f)),
    excluirFicha: id => operar('fichas', 'readwrite', s => s.delete(id)),
    lerFoto: id => operar('fotos', 'readonly', s => s.get(id)),
    salvarFoto: (id, blob) => operar('fotos', 'readwrite', s => s.put(blob, id)),
    excluirFoto: id => operar('fotos', 'readwrite', s => s.delete(id)),
    listarIdsFotos: () => operar('fotos', 'readonly', s => s.getAllKeys()),
    async lerConfig() {
      const c = await operar('config', 'readonly', s => s.get('config'));
      return { ...window.Ficha.CONFIG_PADRAO, categorias: [], ...(c || {}) };
    },
    salvarConfig: c => operar('config', 'readwrite', s => s.put(c, 'config')),
    async limparTudo() {
      for (const s of ['fichas', 'fotos', 'config']) await operar(s, 'readwrite', st => st.clear());
    },
    // Importação de backup numa única transação: se qualquer gravação falhar, nada muda.
    async gravarImportacao({ limpar, config, fichas, fotos }) {
      const db = await abrir();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['fichas', 'fotos', 'config'], 'readwrite');
        const [sf, sp, sc] = ['fichas', 'fotos', 'config'].map(n => tx.objectStore(n));
        if (limpar) { sf.clear(); sp.clear(); sc.clear(); }
        fotos.forEach(([id, blob]) => sp.put(blob, id));
        fichas.forEach(f => sf.put(f));
        sc.put(config, 'config');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
})();
