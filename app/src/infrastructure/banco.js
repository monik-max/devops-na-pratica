const { mkdirSync } = require('node:fs');
const { dirname } = require('node:path');
const { Sequelize, DataTypes, Op } = require('sequelize');
const { contratar } = require('../domain/assinatura');
const { somarDias } = require('../domain/datas');

function criarBanco(storage) {
  if (storage !== ':memory:') mkdirSync(dirname(storage), { recursive: true });
  const sequelize = new Sequelize({ dialect: 'sqlite', storage, logging: false });

  function modelo(nome, atributos) {
    return sequelize.define(nome, {
      codigo: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ...atributos,
    }, { tableName: nome, timestamps: false });
  }

  const texto = () => ({ type: DataTypes.TEXT, allowNull: false });
  const dinheiro = () => ({ type: DataTypes.DECIMAL(12, 2), allowNull: false });
  const data = () => ({ type: DataTypes.DATEONLY, allowNull: false });
  const Cliente = modelo('clientes', { nome: texto(), email: texto() });
  const Plano = modelo('planos', { nome: texto(), custoMensal: dinheiro(), data: data(), descricao: texto() });
  const Assinatura = modelo('assinaturas', {
    codCli: { type: DataTypes.INTEGER, allowNull: false },
    codPlano: { type: DataTypes.INTEGER, allowNull: false },
    inicioFidelidade: data(),
    fimFidelidade: data(),
    dataUltimoPagamento: data(),
    custoFinal: dinheiro(),
    descricao: texto(),
  });

  Assinatura.belongsTo(Cliente, { foreignKey: 'codCli', onDelete: 'RESTRICT' });
  Assinatura.belongsTo(Plano, { foreignKey: 'codPlano', onDelete: 'RESTRICT' });

  function buscar(tabela, codigo) {
    return tabela.findByPk(codigo, { raw: true });
  }

  function listar(tabela, where) {
    return tabela.findAll({ where, raw: true, order: [['codigo', 'ASC']] });
  }

  return {
    clientes: {
      listar: () => listar(Cliente),
      buscar: (codigo) => buscar(Cliente, codigo),
    },
    planos: {
      listar: () => listar(Plano),
      buscar: (codigo) => buscar(Plano, codigo),
      async atualizarCusto(codigo, campos) {
        const [alterados] = await Plano.update(campos, { where: { codigo } });
        return alterados ? buscar(Plano, codigo) : null;
      },
    },
    assinaturas: {
      listar: (where) => listar(Assinatura, where),
      buscar: (codigo) => buscar(Assinatura, codigo),
      async criar(campos) {
        const registro = await Assinatura.create(campos);
        return registro.get({ plain: true });
      },
      async prorrogarFidelidade(codigo, campos) {
        const [alterados] = await Assinatura.update(campos, {
          where: { codigo, fimFidelidade: { [Op.lt]: campos.fimFidelidade } },
        });
        return alterados ? buscar(Assinatura, codigo) : null;
      },
      atualizarPagamento(codigo, dataUltimoPagamento) {
        // A condição no UPDATE impede que eventos antigos ou concorrentes revertam a data.
        return Assinatura.update({ dataUltimoPagamento }, {
          where: { codigo, dataUltimoPagamento: { [Op.lt]: dataUltimoPagamento } },
        });
      },
    },
    async iniciar(hoje) {
      await sequelize.sync();
      await sequelize.transaction(async (transaction) => {
        if (await Cliente.count({ transaction })) return;

        const nomes = [
          'Alice Ribeiro', 'Beatriz Costa', 'Caio Almeida', 'Daniela Gomes', 'Eduardo Silva',
          'Fernanda Alves', 'Gabriel Santos', 'Helena Pereira', 'Igor Rocha', 'Júlia Nunes',
        ];
        await Cliente.bulkCreate(nomes.map((nome) => ({
          nome,
          email: nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(' ', '.') + '@example.com',
        })), { transaction });

        const ofertas = [
          ['Essencial 150 Mbps', 79.90, 'Fibra residencial de 150 Mbps'],
          ['Conecta 300 Mbps', 99.90, 'Fibra residencial de 300 Mbps'],
          ['Casa 500 Mbps', 119.90, 'Fibra residencial de 500 Mbps'],
          ['Max 750 Mbps', 149.90, 'Fibra residencial de 750 Mbps'],
          ['Empresa 1 Gbps', 229.90, 'Fibra empresarial de 1 Gbps'],
        ];
        await Plano.bulkCreate(ofertas.map(([nome, custoMensal, descricao]) => ({
          nome, custoMensal, descricao, data: hoje,
        })), { transaction });

        const contratos = [
          [1, 1, 69.90, 90, 5],
          [2, 2, 89.90, 120, 15],
          [2, 3, 109.90, 150, 40],
          [4, 2, 89.90, 180, 60],
          [5, 4, 129.90, 30, 10],
        ];
        await Assinatura.bulkCreate(contratos.map(([codCli, codPlano, custoFinal, inicio, atraso]) => ({
          ...contratar({
            codCli, codPlano, custoFinal, descricao: 'Desconto promocional de fidelidade.',
          }, somarDias(hoje, -inicio)),
          dataUltimoPagamento: somarDias(hoje, -atraso),
        })), { transaction });
      });
    },
    fechar: () => sequelize.close(),
  };
}

module.exports = { criarBanco };
