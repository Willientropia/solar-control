import ExcelJS from 'exceljs';
import { db } from '../db';
import { usinas, clientes, faturas, geracaoMensal, precosKwh } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import type { Usina, Cliente, Fatura, GeracaoMensal, PrecoKwh } from '../../shared/schema';

/**
 * Serviço de Export/Import de dados para Excel (XLSX)
 *
 * Permite:
 * - Export completo ou parcial de dados para arquivo Excel editável
 * - Import de dados do Excel com validação
 * - Backup legível e portátil dos dados
 */

// ============ TIPOS ============

export interface ExportOptions {
  includeUsinas?: boolean;
  includeClientes?: boolean;
  includeFaturas?: boolean;
  includeGeracao?: boolean;
  includePrecos?: boolean;
  // Filtros opcionais
  usinaId?: string;
  mesReferencia?: string;
}

export interface ImportOptions {
  mode: 'merge' | 'replace' | 'append';
  // merge: atualiza existentes, cria novos
  // replace: apaga tudo e recria
  // append: só cria novos, não atualiza
}

export interface ImportPreview {
  usinas: { criar: number; atualizar: number; erros: string[] };
  clientes: { criar: number; atualizar: number; erros: string[] };
  faturas: { criar: number; atualizar: number; erros: string[] };
  geracao: { criar: number; atualizar: number; erros: string[] };
  precos: { criar: number; atualizar: number; erros: string[] };
}

// ============ CORES E ESTILOS ============

const COLORS = {
  header: 'FF4472C4', // Azul
  metadata: 'FF70AD47', // Verde
  usinas: 'FF5B9BD5', // Azul claro
  clientes: 'FFFFC000', // Laranja
  faturas: 'FF92D050', // Verde claro
  geracao: 'FFC55A11', // Laranja escuro
  precos: 'FF7030A0', // Roxo
};

const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 },
  alignment: { horizontal: 'center', vertical: 'middle' },
  border: {
    top: { style: 'thin' },
    left: { style: 'thin' },
    bottom: { style: 'thin' },
    right: { style: 'thin' },
  },
};

// ============ EXPORT ============

/**
 * Exporta todos os dados para Excel
 */
export async function exportAllData(options: ExportOptions = {}): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'Solar Control';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Aba de metadados
  await createMetadataSheet(workbook, options);

  // Exportar cada entidade conforme opções
  if (options.includeUsinas !== false) {
    await exportUsinas(workbook, options);
  }

  if (options.includeClientes !== false) {
    await exportClientes(workbook, options);
  }

  if (options.includeFaturas !== false) {
    await exportFaturas(workbook, options);
  }

  if (options.includeGeracao !== false) {
    await exportGeracao(workbook, options);
  }

  if (options.includePrecos !== false) {
    await exportPrecos(workbook, options);
  }

  return workbook;
}

/**
 * Cria aba de metadados
 */
async function createMetadataSheet(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('📋 Metadados', {
    properties: { tabColor: { argb: COLORS.metadata } },
  });

  sheet.columns = [
    { header: 'Propriedade', key: 'property', width: 30 },
    { header: 'Valor', key: 'value', width: 50 },
  ];

  // Estilizar header
  sheet.getRow(1).font = { bold: true, size: 12 };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: COLORS.metadata },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };

  // Adicionar metadados
  sheet.addRows([
    { property: 'Sistema', value: 'Solar Control - Sistema de Gestão Solar' },
    { property: 'Versão do Export', value: '1.0.0' },
    { property: 'Data do Export', value: new Date().toLocaleString('pt-BR') },
    { property: 'Formato', value: 'Excel 2007+ (.xlsx)' },
    { property: '', value: '' },
    { property: 'Entidades Exportadas:', value: '' },
    { property: '  • Usinas', value: options.includeUsinas !== false ? 'Sim' : 'Não' },
    { property: '  • Clientes', value: options.includeClientes !== false ? 'Sim' : 'Não' },
    { property: '  • Faturas', value: options.includeFaturas !== false ? 'Sim' : 'Não' },
    { property: '  • Geração Mensal', value: options.includeGeracao !== false ? 'Sim' : 'Não' },
    { property: '  • Preços kWh', value: options.includePrecos !== false ? 'Sim' : 'Não' },
    { property: '', value: '' },
    { property: 'Filtros Aplicados:', value: '' },
    { property: '  • Usina ID', value: options.usinaId || 'Nenhum' },
    { property: '  • Mês Referência', value: options.mesReferencia || 'Nenhum' },
    { property: '', value: '' },
    { property: '⚠️ IMPORTANTE:', value: '' },
    { property: '', value: 'Este arquivo contém todos os dados do sistema.' },
    { property: '', value: 'NÃO compartilhe com pessoas não autorizadas.' },
    { property: '', value: 'Ao importar, certifique-se de escolher o modo correto:' },
    { property: '', value: '  • MERGE: Atualiza existentes + cria novos (recomendado)' },
    { property: '', value: '  • REPLACE: APAGA TUDO e recria (cuidado!)' },
    { property: '', value: '  • APPEND: Só adiciona novos, não atualiza' },
  ]);
}

/**
 * Exporta Usinas
 */
async function exportUsinas(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('🏭 Usinas', {
    properties: { tabColor: { argb: COLORS.usinas } },
  });

  // Definir colunas
  sheet.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'Unidade Consumidora', key: 'unidadeConsumidora', width: 20 },
    { header: 'Produção Mensal Prevista (kWh)', key: 'producaoMensalPrevista', width: 25 },
    { header: 'Potência (kWp)', key: 'potenciaKwp', width: 15 },
    { header: 'Desconto Padrão (%)', key: 'descontoPadrao', width: 18 },
    { header: 'Endereço', key: 'endereco', width: 50 },
    { header: 'Criado Em', key: 'createdAt', width: 20 },
  ];

  // Estilizar header
  applyHeaderStyle(sheet);

  // Buscar dados
  let query = db.select().from(usinas);
  if (options.usinaId) {
    query = query.where(eq(usinas.id, options.usinaId)) as any;
  }

  const data = await query;

  // Adicionar dados
  data.forEach((usina: Usina) => {
    sheet.addRow({
      id: usina.id,
      nome: usina.nome,
      unidadeConsumidora: usina.unidadeConsumidora,
      producaoMensalPrevista: parseFloat(usina.producaoMensalPrevista || '0'),
      potenciaKwp: parseFloat(usina.potenciaKwp || '0'),
      descontoPadrao: parseFloat(usina.descontoPadrao || '0'),
      endereco: usina.endereco,
      createdAt: usina.createdAt,
    });
  });

  // Auto-filtro
  sheet.autoFilter = {
    from: 'A1',
    to: String.fromCharCode(64 + sheet.columns.length) + '1',
  };

  // Freeze primeira linha
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Exporta Clientes
 */
async function exportClientes(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('👥 Clientes', {
    properties: { tabColor: { argb: COLORS.clientes } },
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Nome', key: 'nome', width: 30 },
    { header: 'CPF/CNPJ', key: 'cpfCnpj', width: 18 },
    { header: 'Unidade Consumidora', key: 'unidadeConsumidora', width: 20 },
    { header: 'Usina ID', key: 'usinaId', width: 40 },
    { header: 'Desconto (%)', key: 'desconto', width: 15 },
    { header: 'É Pagante', key: 'isPagante', width: 12 },
    { header: 'Número Contrato', key: 'numeroContrato', width: 20 },
    { header: 'Valor Contratado kWh (R$)', key: 'valorContratadoKwh', width: 25 },
    { header: '% Envio Crédito', key: 'porcentagemEnvioCredito', width: 18 },
    { header: 'Endereço Simplificado', key: 'enderecoSimplificado', width: 25 },
    { header: 'Endereço Completo', key: 'enderecoCompleto', width: 50 },
    { header: 'Ativo', key: 'ativo', width: 10 },
    { header: 'Criado Em', key: 'createdAt', width: 20 },
  ];

  applyHeaderStyle(sheet);

  let query = db.select().from(clientes);
  if (options.usinaId) {
    query = query.where(eq(clientes.usinaId, options.usinaId)) as any;
  }

  const data = await query;

  data.forEach((cliente: Cliente) => {
    sheet.addRow({
      id: cliente.id,
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj,
      unidadeConsumidora: cliente.unidadeConsumidora,
      usinaId: cliente.usinaId,
      desconto: parseFloat(cliente.desconto || '0'),
      isPagante: cliente.isPagante ? 'Sim' : 'Não',
      numeroContrato: cliente.numeroContrato,
      valorContratadoKwh: parseFloat(cliente.valorContratadoKwh || '0'),
      porcentagemEnvioCredito: parseFloat(cliente.porcentagemEnvioCredito || '0'),
      enderecoSimplificado: cliente.enderecoSimplificado,
      enderecoCompleto: cliente.enderecoCompleto,
      ativo: cliente.ativo ? 'Sim' : 'Não',
      createdAt: cliente.createdAt,
    });
  });

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sheet.columns.length) + '1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Exporta Faturas
 */
async function exportFaturas(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('📄 Faturas', {
    properties: { tabColor: { argb: COLORS.faturas } },
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Cliente ID', key: 'clienteId', width: 40 },
    { header: 'Usina ID', key: 'usinaId', width: 40 },
    { header: 'Mês Referência', key: 'mesReferencia', width: 15 },
    { header: 'Data Vencimento', key: 'dataVencimento', width: 15 },
    { header: 'Consumo SCEE (kWh)', key: 'consumoScee', width: 18 },
    { header: 'Consumo Não Compensado (kWh)', key: 'consumoNaoCompensado', width: 28 },
    { header: 'Energia Injetada (kWh)', key: 'energiaInjetada', width: 22 },
    { header: 'Saldo (kWh)', key: 'saldoKwh', width: 15 },
    { header: 'Contrib. Iluminação (R$)', key: 'contribuicaoIluminacao', width: 23 },
    { header: 'Preço kWh (R$)', key: 'precoKwh', width: 15 },
    { header: 'Preço Adc Bandeira (R$)', key: 'precoAdcBandeira', width: 23 },
    { header: 'Preço Fio B (R$)', key: 'precoFioB', width: 18 },
    { header: 'Valor Total (R$)', key: 'valorTotal', width: 18 },
    { header: 'Valor Sem Desconto (R$)', key: 'valorSemDesconto', width: 23 },
    { header: 'Valor Com Desconto (R$)', key: 'valorComDesconto', width: 23 },
    { header: 'Economia (R$)', key: 'economia', width: 15 },
    { header: 'Lucro (R$)', key: 'lucro', width: 15 },
    { header: 'Status', key: 'status', width: 25 },
    { header: 'Arquivo PDF URL', key: 'arquivoPdfUrl', width: 30 },
    { header: 'Fatura Gerada URL', key: 'faturaGeradaUrl', width: 30 },
    { header: 'Criado Em', key: 'createdAt', width: 20 },
  ];

  applyHeaderStyle(sheet);

  let query = db.select().from(faturas);
  if (options.usinaId) {
    query = query.where(eq(faturas.usinaId, options.usinaId)) as any;
  }
  if (options.mesReferencia) {
    query = query.where(eq(faturas.mesReferencia, options.mesReferencia)) as any;
  }

  const data = await query;

  data.forEach((fatura: Fatura) => {
    sheet.addRow({
      id: fatura.id,
      clienteId: fatura.clienteId,
      usinaId: fatura.usinaId,
      mesReferencia: fatura.mesReferencia,
      dataVencimento: fatura.dataVencimento,
      consumoScee: parseFloat(fatura.consumoScee || '0'),
      consumoNaoCompensado: parseFloat(fatura.consumoNaoCompensado || '0'),
      energiaInjetada: parseFloat(fatura.energiaInjetada || '0'),
      saldoKwh: parseFloat(fatura.saldoKwh || '0'),
      contribuicaoIluminacao: parseFloat(fatura.contribuicaoIluminacao || '0'),
      precoKwh: parseFloat(fatura.precoKwh || '0'),
      precoAdcBandeira: parseFloat(fatura.precoAdcBandeira || '0'),
      precoFioB: parseFloat(fatura.precoFioB || '0'),
      valorTotal: parseFloat(fatura.valorTotal || '0'),
      valorSemDesconto: parseFloat(fatura.valorSemDesconto || '0'),
      valorComDesconto: parseFloat(fatura.valorComDesconto || '0'),
      economia: parseFloat(fatura.economia || '0'),
      lucro: parseFloat(fatura.lucro || '0'),
      status: fatura.status,
      arquivoPdfUrl: fatura.arquivoPdfUrl,
      faturaGeradaUrl: fatura.faturaGeradaUrl,
      createdAt: fatura.createdAt,
    });
  });

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sheet.columns.length) + '1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Exporta Geração Mensal
 */
async function exportGeracao(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('⚡ Geração Mensal', {
    properties: { tabColor: { argb: COLORS.geracao } },
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Usina ID', key: 'usinaId', width: 40 },
    { header: 'Mês Referência', key: 'mesReferencia', width: 15 },
    { header: 'kWh Gerado', key: 'kwhGerado', width: 15 },
    { header: 'Alerta Baixa Geração', key: 'alertaBaixaGeracao', width: 22 },
    { header: 'Observações', key: 'observacoes', width: 50 },
    { header: 'Criado Em', key: 'createdAt', width: 20 },
  ];

  applyHeaderStyle(sheet);

  let query = db.select().from(geracaoMensal);
  if (options.usinaId) {
    query = query.where(eq(geracaoMensal.usinaId, options.usinaId)) as any;
  }
  if (options.mesReferencia) {
    query = query.where(eq(geracaoMensal.mesReferencia, options.mesReferencia)) as any;
  }

  const data = await query;

  data.forEach((geracao: GeracaoMensal) => {
    sheet.addRow({
      id: geracao.id,
      usinaId: geracao.usinaId,
      mesReferencia: geracao.mesReferencia,
      kwhGerado: parseFloat(geracao.kwhGerado || '0'),
      alertaBaixaGeracao: geracao.alertaBaixaGeracao ? 'Sim' : 'Não',
      observacoes: geracao.observacoes,
      createdAt: geracao.createdAt,
    });
  });

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sheet.columns.length) + '1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Exporta Preços kWh
 */
async function exportPrecos(workbook: ExcelJS.Workbook, options: ExportOptions) {
  const sheet = workbook.addWorksheet('💰 Preços kWh', {
    properties: { tabColor: { argb: COLORS.precos } },
  });

  sheet.columns = [
    { header: 'ID', key: 'id', width: 40 },
    { header: 'Mês Referência', key: 'mesReferencia', width: 15 },
    { header: 'TUSD', key: 'tusd', width: 15 },
    { header: 'TE', key: 'te', width: 15 },
    { header: 'ICMS (%)', key: 'icms', width: 12 },
    { header: 'PIS (%)', key: 'pis', width: 12 },
    { header: 'COFINS (%)', key: 'cofins', width: 12 },
    { header: 'Preço kWh Calculado', key: 'precoKwhCalculado', width: 22 },
    { header: 'Criado Em', key: 'createdAt', width: 20 },
  ];

  applyHeaderStyle(sheet);

  let query = db.select().from(precosKwh);
  if (options.mesReferencia) {
    query = query.where(eq(precosKwh.mesReferencia, options.mesReferencia)) as any;
  }

  const data = await query;

  data.forEach((preco: PrecoKwh) => {
    sheet.addRow({
      id: preco.id,
      mesReferencia: preco.mesReferencia,
      tusd: parseFloat(preco.tusd || '0'),
      te: parseFloat(preco.te || '0'),
      icms: parseFloat(preco.icms || '0'),
      pis: parseFloat(preco.pis || '0'),
      cofins: parseFloat(preco.cofins || '0'),
      precoKwhCalculado: parseFloat(preco.precoKwhCalculado || '0'),
      createdAt: preco.createdAt,
    });
  });

  sheet.autoFilter = { from: 'A1', to: String.fromCharCode(64 + sheet.columns.length) + '1' };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

/**
 * Aplica estilo no header
 */
function applyHeaderStyle(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.height = 25;

  headerRow.eachCell((cell) => {
    cell.font = HEADER_STYLE.font;
    cell.alignment = HEADER_STYLE.alignment;
    cell.border = HEADER_STYLE.border;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.header },
    };
  });

  sheet.views = [{ state: 'frozen', ySplit: 1 }];
}

// ============ IMPORT ============

/**
 * Gera preview do import (sem salvar no banco)
 */
export async function previewImport(filePath: string): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const preview: ImportPreview = {
    usinas: { criar: 0, atualizar: 0, erros: [] },
    clientes: { criar: 0, atualizar: 0, erros: [] },
    faturas: { criar: 0, atualizar: 0, erros: [] },
    geracao: { criar: 0, atualizar: 0, erros: [] },
    precos: { criar: 0, atualizar: 0, erros: [] },
  };

  // Validar cada aba
  const usinasSheet = workbook.getWorksheet('🏭 Usinas');
  if (usinasSheet) {
    await validateUsinasSheet(usinasSheet, preview.usinas);
  }

  const clientesSheet = workbook.getWorksheet('👥 Clientes');
  if (clientesSheet) {
    await validateClientesSheet(clientesSheet, preview.clientes);
  }

  const faturasSheet = workbook.getWorksheet('📄 Faturas');
  if (faturasSheet) {
    await validateFaturasSheet(faturasSheet, preview.faturas);
  }

  const geracaoSheet = workbook.getWorksheet('⚡ Geração Mensal');
  if (geracaoSheet) {
    await validateGeracaoSheet(geracaoSheet, preview.geracao);
  }

  const precosSheet = workbook.getWorksheet('💰 Preços kWh');
  if (precosSheet) {
    await validatePrecosSheet(precosSheet, preview.precos);
  }

  return preview;
}

/**
 * Importa dados do Excel
 */
export async function importFromExcel(filePath: string, options: ImportOptions): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const result: ImportPreview = {
    usinas: { criar: 0, atualizar: 0, erros: [] },
    clientes: { criar: 0, atualizar: 0, erros: [] },
    faturas: { criar: 0, atualizar: 0, erros: [] },
    geracao: { criar: 0, atualizar: 0, erros: [] },
    precos: { criar: 0, atualizar: 0, erros: [] },
  };

  // Modo REPLACE: apagar tudo primeiro (CUIDADO!)
  if (options.mode === 'replace') {
    await db.delete(faturas);
    await db.delete(geracaoMensal);
    await db.delete(clientes);
    await db.delete(usinas);
    await db.delete(precosKwh);
  }

  // Importar na ordem correta (respeitando FKs)
  // 1. Usinas (não tem FK)
  const usinasSheet = workbook.getWorksheet('🏭 Usinas');
  if (usinasSheet) {
    await importUsinasSheet(usinasSheet, options, result.usinas);
  }

  // 2. Preços (não tem FK)
  const precosSheet = workbook.getWorksheet('💰 Preços kWh');
  if (precosSheet) {
    await importPrecosSheet(precosSheet, options, result.precos);
  }

  // 3. Clientes (FK para usinas)
  const clientesSheet = workbook.getWorksheet('👥 Clientes');
  if (clientesSheet) {
    await importClientesSheet(clientesSheet, options, result.clientes);
  }

  // 4. Faturas (FK para clientes e usinas)
  const faturasSheet = workbook.getWorksheet('📄 Faturas');
  if (faturasSheet) {
    await importFaturasSheet(faturasSheet, options, result.faturas);
  }

  // 5. Geração (FK para usinas)
  const geracaoSheet = workbook.getWorksheet('⚡ Geração Mensal');
  if (geracaoSheet) {
    await importGeracaoSheet(geracaoSheet, options, result.geracao);
  }

  return result;
}

// ============ VALIDAÇÃO ============

async function validateUsinasSheet(sheet: ExcelJS.Worksheet, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue; // Linha vazia

    const id = String(row.getCell(1).value);
    const existing = await db.select().from(usinas).where(eq(usinas.id, id)).limit(1);

    if (existing.length > 0) {
      stats.atualizar++;
    } else {
      stats.criar++;
    }

    // Validar campos obrigatórios
    if (!row.getCell(2).value) {
      stats.erros.push(`Linha ${row.number}: Nome é obrigatório`);
    }
    if (!row.getCell(3).value) {
      stats.erros.push(`Linha ${row.number}: Unidade Consumidora é obrigatória`);
    }
  }
}

async function validateClientesSheet(sheet: ExcelJS.Worksheet, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    const id = String(row.getCell(1).value);
    const existing = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);

    if (existing.length > 0) {
      stats.atualizar++;
    } else {
      stats.criar++;
    }

    // Validar campos obrigatórios
    if (!row.getCell(2).value) {
      stats.erros.push(`Linha ${row.number}: Nome é obrigatório`);
    }
    if (!row.getCell(4).value) {
      stats.erros.push(`Linha ${row.number}: Unidade Consumidora é obrigatória`);
    }
    if (!row.getCell(5).value) {
      stats.erros.push(`Linha ${row.number}: Usina ID é obrigatório`);
    }
  }
}

async function validateFaturasSheet(sheet: ExcelJS.Worksheet, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    const id = String(row.getCell(1).value);
    const existing = await db.select().from(faturas).where(eq(faturas.id, id)).limit(1);

    if (existing.length > 0) {
      stats.atualizar++;
    } else {
      stats.criar++;
    }

    // Validar campos obrigatórios
    if (!row.getCell(2).value) {
      stats.erros.push(`Linha ${row.number}: Cliente ID é obrigatório`);
    }
    if (!row.getCell(4).value) {
      stats.erros.push(`Linha ${row.number}: Mês Referência é obrigatório`);
    }
  }
}

async function validateGeracaoSheet(sheet: ExcelJS.Worksheet, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    const id = String(row.getCell(1).value);
    const existing = await db.select().from(geracaoMensal).where(eq(geracaoMensal.id, id)).limit(1);

    if (existing.length > 0) {
      stats.atualizar++;
    } else {
      stats.criar++;
    }

    // Validar campos obrigatórios
    if (!row.getCell(2).value) {
      stats.erros.push(`Linha ${row.number}: Usina ID é obrigatório`);
    }
    if (!row.getCell(3).value) {
      stats.erros.push(`Linha ${row.number}: Mês Referência é obrigatório`);
    }
    if (!row.getCell(4).value) {
      stats.erros.push(`Linha ${row.number}: kWh Gerado é obrigatório`);
    }
  }
}

async function validatePrecosSheet(sheet: ExcelJS.Worksheet, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    const id = String(row.getCell(1).value);
    const existing = await db.select().from(precosKwh).where(eq(precosKwh.id, id)).limit(1);

    if (existing.length > 0) {
      stats.atualizar++;
    } else {
      stats.criar++;
    }

    // Validar campos obrigatórios
    if (!row.getCell(2).value) {
      stats.erros.push(`Linha ${row.number}: Mês Referência é obrigatório`);
    }
  }
}

// ============ IMPORT SHEETS ============

async function importUsinasSheet(sheet: ExcelJS.Worksheet, options: ImportOptions, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    try {
      const data = {
        id: String(row.getCell(1).value),
        nome: String(row.getCell(2).value || ''),
        unidadeConsumidora: String(row.getCell(3).value || ''),
        producaoMensalPrevista: String(row.getCell(4).value || '0'),
        potenciaKwp: String(row.getCell(5).value || '0'),
        descontoPadrao: String(row.getCell(6).value || '15'),
        endereco: row.getCell(7).value ? String(row.getCell(7).value) : null,
      };

      const existing = await db.select().from(usinas).where(eq(usinas.id, data.id)).limit(1);

      if (existing.length > 0) {
        if (options.mode !== 'append') {
          await db.update(usinas).set(data).where(eq(usinas.id, data.id));
          stats.atualizar++;
        }
      } else {
        await db.insert(usinas).values(data);
        stats.criar++;
      }
    } catch (error: any) {
      stats.erros.push(`Linha ${row.number}: ${error.message}`);
    }
  }
}

async function importClientesSheet(sheet: ExcelJS.Worksheet, options: ImportOptions, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    try {
      const data = {
        id: String(row.getCell(1).value),
        nome: String(row.getCell(2).value || ''),
        cpfCnpj: row.getCell(3).value ? String(row.getCell(3).value) : null,
        unidadeConsumidora: String(row.getCell(4).value || ''),
        usinaId: String(row.getCell(5).value),
        desconto: String(row.getCell(6).value || '15'),
        isPagante: String(row.getCell(7).value) === 'Sim',
        numeroContrato: row.getCell(8).value ? String(row.getCell(8).value) : null,
        valorContratadoKwh: row.getCell(9).value ? String(row.getCell(9).value) : null,
        porcentagemEnvioCredito: row.getCell(10).value ? String(row.getCell(10).value) : null,
        enderecoSimplificado: row.getCell(11).value ? String(row.getCell(11).value) : null,
        enderecoCompleto: row.getCell(12).value ? String(row.getCell(12).value) : null,
        ativo: String(row.getCell(13).value) !== 'Não',
      };

      const existing = await db.select().from(clientes).where(eq(clientes.id, data.id)).limit(1);

      if (existing.length > 0) {
        if (options.mode !== 'append') {
          await db.update(clientes).set(data).where(eq(clientes.id, data.id));
          stats.atualizar++;
        }
      } else {
        await db.insert(clientes).values(data);
        stats.criar++;
      }
    } catch (error: any) {
      stats.erros.push(`Linha ${row.number}: ${error.message}`);
    }
  }
}

async function importFaturasSheet(sheet: ExcelJS.Worksheet, options: ImportOptions, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    try {
      const data: any = {
        id: String(row.getCell(1).value),
        clienteId: String(row.getCell(2).value),
        usinaId: row.getCell(3).value ? String(row.getCell(3).value) : null,
        mesReferencia: String(row.getCell(4).value),
        dataVencimento: row.getCell(5).value ? String(row.getCell(5).value) : null,
        consumoScee: row.getCell(6).value ? String(row.getCell(6).value) : null,
        consumoNaoCompensado: row.getCell(7).value ? String(row.getCell(7).value) : null,
        energiaInjetada: row.getCell(8).value ? String(row.getCell(8).value) : null,
        saldoKwh: row.getCell(9).value ? String(row.getCell(9).value) : null,
        contribuicaoIluminacao: row.getCell(10).value ? String(row.getCell(10).value) : null,
        precoKwh: row.getCell(11).value ? String(row.getCell(11).value) : null,
        precoAdcBandeira: row.getCell(12).value ? String(row.getCell(12).value) : null,
        precoFioB: row.getCell(13).value ? String(row.getCell(13).value) : null,
        valorTotal: row.getCell(14).value ? String(row.getCell(14).value) : null,
        valorSemDesconto: row.getCell(15).value ? String(row.getCell(15).value) : null,
        valorComDesconto: row.getCell(16).value ? String(row.getCell(16).value) : null,
        economia: row.getCell(17).value ? String(row.getCell(17).value) : null,
        lucro: row.getCell(18).value ? String(row.getCell(18).value) : null,
        status: String(row.getCell(19).value || 'aguardando_upload'),
        arquivoPdfUrl: row.getCell(20).value ? String(row.getCell(20).value) : null,
        faturaGeradaUrl: row.getCell(21).value ? String(row.getCell(21).value) : null,
      };

      const existing = await db.select().from(faturas).where(eq(faturas.id, data.id)).limit(1);

      if (existing.length > 0) {
        if (options.mode !== 'append') {
          await db.update(faturas).set(data).where(eq(faturas.id, data.id));
          stats.atualizar++;
        }
      } else {
        await db.insert(faturas).values(data);
        stats.criar++;
      }
    } catch (error: any) {
      stats.erros.push(`Linha ${row.number}: ${error.message}`);
    }
  }
}

async function importGeracaoSheet(sheet: ExcelJS.Worksheet, options: ImportOptions, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    try {
      const data: any = {
        id: String(row.getCell(1).value),
        usinaId: String(row.getCell(2).value),
        mesReferencia: String(row.getCell(3).value),
        kwhGerado: String(row.getCell(4).value),
        alertaBaixaGeracao: String(row.getCell(5).value) === 'Sim',
        observacoes: row.getCell(6).value ? String(row.getCell(6).value) : null,
      };

      const existing = await db.select().from(geracaoMensal).where(eq(geracaoMensal.id, data.id)).limit(1);

      if (existing.length > 0) {
        if (options.mode !== 'append') {
          await db.update(geracaoMensal).set(data).where(eq(geracaoMensal.id, data.id));
          stats.atualizar++;
        }
      } else {
        await db.insert(geracaoMensal).values(data);
        stats.criar++;
      }
    } catch (error: any) {
      stats.erros.push(`Linha ${row.number}: ${error.message}`);
    }
  }
}

async function importPrecosSheet(sheet: ExcelJS.Worksheet, options: ImportOptions, stats: { criar: number; atualizar: number; erros: string[] }) {
  const rows = sheet.getRows(2, sheet.rowCount - 1) || [];

  for (const row of rows) {
    if (!row.getCell(1).value) continue;

    try {
      const data: any = {
        id: String(row.getCell(1).value),
        mesReferencia: String(row.getCell(2).value),
        tusd: String(row.getCell(3).value),
        te: String(row.getCell(4).value),
        icms: String(row.getCell(5).value),
        pis: String(row.getCell(6).value),
        cofins: String(row.getCell(7).value),
        precoKwhCalculado: String(row.getCell(8).value),
      };

      const existing = await db.select().from(precosKwh).where(eq(precosKwh.id, data.id)).limit(1);

      if (existing.length > 0) {
        if (options.mode !== 'append') {
          await db.update(precosKwh).set(data).where(eq(precosKwh.id, data.id));
          stats.atualizar++;
        }
      } else {
        await db.insert(precosKwh).values(data);
        stats.criar++;
      }
    } catch (error: any) {
      stats.erros.push(`Linha ${row.number}: ${error.message}`);
    }
  }
}

// ============ EXPORT ============

export const ExcelService = {
  exportAllData,
  previewImport,
  importFromExcel,
};
