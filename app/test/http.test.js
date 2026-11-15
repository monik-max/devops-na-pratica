const assert = require('node:assert/strict');
const { once } = require('node:events');
const test = require('node:test');
const { criarGestao } = require('../src/application/gerenciar-planos');
const { criarBanco } = require('../src/infrastructure/banco');
const { criarApp } = require('../src/interfaces/http');

test('verifica saúde do serviço e lista dados da carga inicial por HTTP', async (t) => {
  const banco = criarBanco(':memory:');
  const hoje = () => '2026-11-14';
  await banco.iniciar(hoje());
  const server = criarApp(criarGestao({ ...banco, relogio: hoje })).listen(0, '127.0.0.1');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((erro) => erro ? reject(erro) : resolve()));
    await banco.fechar();
  });
  await once(server, 'listening');

  const base = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(base + '/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const clientes = await fetch(base + '/gestao/clientes');
  assert.equal(clientes.status, 200);
  assert.equal((await clientes.json()).length, 10);
});
