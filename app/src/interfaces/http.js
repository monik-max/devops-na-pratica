const express = require('express');
const { DadosInvalidos, RegistroInexistente } = require('../domain/erros');

function criarApp(gestao) {
  const app = express();
  const rotas = express.Router();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const inicio = process.hrtime.bigint();
    const caminho = req.path;
    res.once('finish', () => {
      const duracaoMs = Number(process.hrtime.bigint() - inicio) / 1_000_000;
      console.log(JSON.stringify({
        horario: new Date().toISOString(),
        metodo: req.method,
        caminho,
        status: res.statusCode,
        duracaoMs: Math.round(duracaoMs),
      }));
    });
    next();
  });

  app.get('/health', responder(async () => {
    await gestao.listarClientes();
    return { status: 'ok' };
  }));

  function responder(tratar, status = 200) {
    return (req, res, next) => {
      Promise.resolve().then(() => tratar(req))
        .then((dados) => res.status(status).json(dados))
        .catch(next);
    };
  }

  rotas.get('/clientes', responder(gestao.listarClientes));
  rotas.get('/planos', responder(gestao.listarPlanos));
  rotas.post('/assinaturas', responder((req) => gestao.criarAssinatura(req.body), 201));
  rotas.patch('/planos/:idPlano', responder((req) => gestao.atualizarCusto(req.params.idPlano, req.body?.custoMensal)));
  rotas.get('/assinaturas/:tipo', responder((req) => gestao.listarAssinaturas(req.params.tipo)));
  rotas.get(['/assinaturascliente/:id', '/asscli/:id'], responder((req) => gestao.listarPorCliente(req.params.id)));
  rotas.get(['/assinaturasplano/:id', '/assinaturaplano/:id'], responder((req) => gestao.listarPorPlano(req.params.id)));
  rotas.patch('/assinaturas/:id/fidelidade', responder((req) => gestao.prorrogarFidelidade(req.params.id, req.body)));
  rotas.get('/assinatura/:id', responder((req) => gestao.consultarAssinatura(req.params.id)));

  app.use(express.json());
  // O PDF e o roteiro do Postman apresentam prefixos diferentes para as mesmas operações.
  app.use(['/gestao', '/gerenciaplanos'], rotas);

  app.use((erro, req, res, next) => {
    if (erro instanceof DadosInvalidos || erro.type === 'entity.parse.failed') {
      const mensagem = erro.type === 'entity.parse.failed' ? 'JSON inválido.' : erro.message;
      return res.status(400).json({ erro: mensagem });
    }
    if (erro instanceof RegistroInexistente) return res.status(404).json({ erro: erro.message });
    console.error(erro);
    return res.status(500).json({ erro: 'Erro interno do Serviço Gestão.' });
  });

  return app;
}

module.exports = { criarApp };
