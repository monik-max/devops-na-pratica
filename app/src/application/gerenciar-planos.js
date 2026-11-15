const { contratar, consultar } = require('../domain/assinatura');
const { dataISOValida } = require('../domain/datas');
const { DadosInvalidos, RegistroInexistente } = require('../domain/erros');

const TIPOS = ['TODOS', 'ATIVOS', 'CANCELADOS'];

function codigo(valor, campo) {
  const id = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new DadosInvalidos(campo + ' deve ser um inteiro positivo.');
  }
  return id;
}

function valorMonetario(valor, campo) {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new DadosInvalidos(campo + ' deve ser um número não negativo.');
  }
  return valor;
}

function descricaoPreenchida(descricao) {
  if (typeof descricao !== 'string' || !descricao.trim()) {
    throw new DadosInvalidos('descricao deve ser um texto preenchido.');
  }
  return descricao.trim();
}

function existente(registro, entidade, id) {
  if (!registro) throw new RegistroInexistente(entidade + ' ' + id + ' não encontrado.');
  return registro;
}

function criarGestao({ clientes, planos, assinaturas, relogio }) {
  return {
    listarClientes: () => clientes.listar(),
    listarPlanos: () => planos.listar(),

    async criarAssinatura(dados = {}) {
      const codCli = codigo(dados.codCli, 'codCli');
      const codPlano = codigo(dados.codPlano, 'codPlano');
      const custoFinal = valorMonetario(dados.custoFinal, 'custoFinal');
      const descricao = descricaoPreenchida(dados.descricao);
      const [cliente, plano] = await Promise.all([clientes.buscar(codCli), planos.buscar(codPlano)]);
      existente(cliente, 'Cliente', codCli);
      existente(plano, 'Plano', codPlano);

      const data = relogio();
      const assinatura = contratar({ codCli, codPlano, custoFinal, descricao }, data);
      return consultar(await assinaturas.criar(assinatura), data);
    },

    async atualizarCusto(id, custo) {
      const codPlano = codigo(id, 'idPlano');
      const custoMensal = valorMonetario(custo, 'custoMensal');
      const plano = await planos.atualizarCusto(codPlano, { custoMensal, data: relogio() });
      return existente(plano, 'Plano', codPlano);
    },

    async listarAssinaturas(tipo) {
      if (!TIPOS.includes(tipo)) {
        throw new DadosInvalidos('tipo deve ser TODOS, ATIVOS ou CANCELADOS.');
      }
      const data = relogio();
      const resultado = (await assinaturas.listar()).map((item) => consultar(item, data));
      return tipo === 'TODOS' ? resultado : resultado.filter((item) => item.status + 'S' === tipo);
    },

    async listarPorCliente(id) {
      const codCli = codigo(id, 'codCli');
      const data = relogio();
      return (await assinaturas.listar({ codCli })).map((item) => consultar(item, data));
    },

    async listarPorPlano(id) {
      const codPlano = codigo(id, 'codPlano');
      const data = relogio();
      return (await assinaturas.listar({ codPlano })).map((item) => consultar(item, data));
    },

    async consultarAssinatura(id) {
      const codAss = codigo(id, 'codAss');
      const assinatura = existente(await assinaturas.buscar(codAss), 'Assinatura', codAss);
      const plano = await planos.buscar(assinatura.codPlano);
      const data = relogio();
      return {
        ...consultar(assinatura, data),
        custoMensalVigente: data < assinatura.fimFidelidade ? assinatura.custoFinal : plano.custoMensal,
      };
    },

    async prorrogarFidelidade(id, dados = {}) {
      const codAss = codigo(id, 'codAss');
      const data = relogio();
      const { fimFidelidade } = dados;
      if (!dataISOValida(fimFidelidade) || fimFidelidade <= data) {
        throw new DadosInvalidos('fimFidelidade deve ser uma data futura no formato AAAA-MM-DD.');
      }
      const custoFinal = valorMonetario(dados.custoFinal, 'custoFinal');
      const descricao = descricaoPreenchida(dados.descricao);
      existente(await assinaturas.buscar(codAss), 'Assinatura', codAss);

      const assinatura = await assinaturas.prorrogarFidelidade(codAss, { fimFidelidade, custoFinal, descricao });
      if (!assinatura) throw new DadosInvalidos('fimFidelidade deve ser posterior ao fim já cadastrado.');
      return consultar(assinatura, data);
    },

    async registrarPagamento({ codAss, dataPagamento }) {
      const id = codigo(codAss, 'codAss');
      if (!dataISOValida(dataPagamento)) throw new DadosInvalidos('dataPagamento inválida.');
      existente(await assinaturas.buscar(id), 'Assinatura', id);
      await assinaturas.atualizarPagamento(id, dataPagamento);
    },
  };
}

module.exports = { criarGestao };
