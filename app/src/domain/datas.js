const formato = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function hoje() {
  return formato.format(new Date());
}

function dataISOValida(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const instante = new Date(data + 'T00:00:00Z');
  return Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === data;
}

function somarDias(data, dias) {
  // UTC serve apenas para calcular datas de calendário inteiras.
  const instante = new Date(data + 'T00:00:00Z');
  instante.setUTCDate(instante.getUTCDate() + dias);
  return instante.toISOString().slice(0, 10);
}

module.exports = { hoje, dataISOValida, somarDias };
