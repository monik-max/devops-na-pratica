const path = require('node:path');
const { hoje } = require('./domain/datas');
const { criarGestao } = require('./application/gerenciar-planos');
const { criarBanco } = require('./infrastructure/banco');
const { criarApp } = require('./interfaces/http');

async function iniciar() {
  const porta = Number(process.env.PORT || 3000);
  const storage = process.env.DB_STORAGE || path.resolve(__dirname, '../data/gestao.sqlite');
  const banco = criarBanco(storage);
  await banco.iniciar(hoje());
  const gestao = criarGestao({ ...banco, relogio: hoje });

  criarApp(gestao).listen(porta, () => console.log('Serviço Gestão na porta ' + porta));
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar o Serviço Gestão:', erro);
  process.exitCode = 1;
});
