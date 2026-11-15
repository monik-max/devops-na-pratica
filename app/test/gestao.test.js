const { test } = require('node:test');
const assert = require('node:assert/strict');
const { criarGestao } = require('../src/application/gerenciar-planos');
const { criarBanco } = require('../src/infrastructure/banco');
const { consultar, contratar } = require('../src/domain/assinatura');
const { DadosInvalidos, RegistroInexistente } = require('../src/domain/erros');

const DATA = '2026-11-14';

test('a fidelidade dura 365 dias e a validade segue o prazo de pagamento', () => {
  const assinatura = contratar({ codCli: 1, codPlano: 1, custoFinal: 69.90, descricao: 'Oferta' }, DATA);
  assert.equal(assinatura.fimFidelidade, '2027-11-14');
  assert.equal(consultar(assinatura, '2026-12-13').status, 'ATIVO');
  assert.equal(consultar(assinatura, '2026-12-14').status, 'CANCELADO');
});

test('gestão usa o banco inicializado e mantém a data do pagamento mais recente', async (t) => {
  const banco = criarBanco(':memory:');
  t.after(() => banco.fechar());
  await banco.iniciar(DATA);
  await banco.iniciar(DATA);
  const gestao = criarGestao({ ...banco, relogio: () => DATA });

  assert.equal((await gestao.listarClientes()).length, 10);
  assert.equal((await gestao.listarPlanos()).length, 5);
  assert.equal((await gestao.listarAssinaturas('TODOS')).length, 5);
  assert.equal((await gestao.listarAssinaturas('ATIVOS')).length, 3);
  assert.equal((await gestao.listarAssinaturas('CANCELADOS')).length, 2);
  assert.equal((await gestao.listarPorCliente(2)).length, 2);
  assert.equal((await gestao.listarPorPlano(2)).length, 2);

  const criada = await gestao.criarAssinatura({
    codCli: 3, codPlano: 5, custoFinal: 179.90, descricao: 'Oferta empresarial',
  });
  assert.equal(criada.codigo, 6);
  assert.equal(criada.status, 'ATIVO');
  assert.equal((await gestao.atualizarCusto(5, 219.99)).custoMensal, 219.99);
  await assert.rejects(gestao.atualizarCusto(5, -1), DadosInvalidos);
  await assert.rejects(gestao.consultarAssinatura(9999), RegistroInexistente);
  await assert.rejects(gestao.registrarPagamento({ codAss: 3, dataPagamento: '2026-02-30' }), DadosInvalidos);

  await Promise.all([
    gestao.registrarPagamento({ codAss: 3, dataPagamento: DATA }),
    gestao.registrarPagamento({ codAss: 3, dataPagamento: '2026-09-20' }),
  ]);
  const reativada = await gestao.consultarAssinatura(3);
  assert.equal(reativada.dataUltimoPagamento, DATA);
  assert.equal(reativada.status, 'ATIVO');
});

test('prorroga a fidelidade e usa o preço do plano quando o período termina', async (t) => {
  const banco = criarBanco(':memory:');
  t.after(() => banco.fechar());
  await banco.iniciar(DATA);
  let dia = DATA;
  const gestao = criarGestao({ ...banco, relogio: () => dia });
  const anterior = await gestao.consultarAssinatura(1);
  assert.equal(anterior.custoMensalVigente, 69.90);
  assert.equal(anterior.inicioFidelidade, '2026-08-16');
  assert.equal(anterior.fimFidelidade, '2027-08-16');
  assert.equal(anterior.dataUltimoPagamento, '2026-11-09');

  const novaOferta = {
    fimFidelidade: '2028-01-15',
    custoFinal: 59.90,
    descricao: 'Renovação promocional',
  };
  const renovada = await gestao.prorrogarFidelidade(1, novaOferta);
  assert.equal(renovada.fimFidelidade, novaOferta.fimFidelidade);
  assert.equal(renovada.custoFinal, novaOferta.custoFinal);
  assert.equal(renovada.descricao, novaOferta.descricao);
  assert.equal(renovada.inicioFidelidade, anterior.inicioFidelidade);
  assert.equal(renovada.dataUltimoPagamento, anterior.dataUltimoPagamento);
  assert.equal((await gestao.consultarAssinatura(1)).custoMensalVigente, 59.90);
  await assert.rejects(gestao.prorrogarFidelidade(1, novaOferta), DadosInvalidos);

  dia = novaOferta.fimFidelidade;
  await gestao.atualizarCusto(1, 89.90);
  const vencida = await gestao.consultarAssinatura(1);
  assert.equal(vencida.custoFinal, 59.90);
  assert.equal(vencida.custoMensalVigente, 89.90);
  assert.equal(vencida.status, 'CANCELADO');
});
