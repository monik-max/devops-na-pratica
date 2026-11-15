const { somarDias } = require('./datas');

const DIAS_FIDELIDADE = 365;
const DIAS_ENTRE_PAGAMENTOS = 30;

function contratar({ codCli, codPlano, custoFinal, descricao }, dataInicio) {
  return {
    codCli,
    codPlano,
    custoFinal,
    descricao,
    inicioFidelidade: dataInicio,
    fimFidelidade: somarDias(dataInicio, DIAS_FIDELIDADE),
    // Neste projeto, a contratação inclui a primeira mensalidade.
    dataUltimoPagamento: dataInicio,
  };
}

function consultar(assinatura, dataConsulta) {
  // No dia do vencimento, um novo pagamento é necessário para manter o serviço ativo.
  const validaAte = somarDias(assinatura.dataUltimoPagamento, DIAS_ENTRE_PAGAMENTOS);
  return {
    ...assinatura,
    validaAte,
    status: dataConsulta < validaAte ? 'ATIVO' : 'CANCELADO',
  };
}

module.exports = { contratar, consultar };
