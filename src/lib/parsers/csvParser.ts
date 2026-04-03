import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { Agent, CsvParseResult, Leader } from '../../types';
import { parseTimeRange, parseContractHours, timeToMinutes } from '../utils/timeParser';

type CsvRow = Record<string, unknown>;

function toTrimmedString(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') return String(value).trim();
  return fallback;
}

/**
 * Parse CSV or XLSX file — detects format by extension
 */
export function parseCsvFile(file: File): Promise<CsvParseResult> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    return parseXlsxFile(file);
  }
  return parseCsvOnly(file);
}

/**
 * Parse CSV file using PapaParse
 */
function parseCsvOnly(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          resolve(processCsvData(results.data as CsvRow[]));
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}

/**
 * Parse XLSX/XLS file using SheetJS
 */
function parseXlsxFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(processCsvData(rows as CsvRow[]));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Error leyendo el archivo'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Convert Excel time serial (0–1 fraction of day) to "HH:mm"
 */
function excelTimeToString(value: number): string {
  const totalMinutes = Math.round(value * 24 * 60);
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Normalize a raw row from CSV or XLSX:
 * - Keys to UPPERCASE
 * - Excel time serials → "HH:mm"
 * - Numeric CONTRATO → "Nhs"
 * - Other values → string
 */
function normalizeRow(raw: CsvRow): CsvRow {
  const row: CsvRow = {};

  // Normalize keys to uppercase
  for (const key of Object.keys(raw)) {
    row[key.trim().toUpperCase()] = raw[key];
  }

  // HORARIOS: Excel stores times as fractions 0–1
  if (typeof row.HORARIOS === 'number') {
    row.HORARIOS = excelTimeToString(row.HORARIOS);
  } else if (row.HORARIOS != null) {
    row.HORARIOS = String(row.HORARIOS).trim();
  }

  // CONTRATO: may come as bare number (30, 35, 36)
  if (typeof row.CONTRATO === 'number') {
    row.CONTRATO = `${row.CONTRATO}hs`;
  } else if (row.CONTRATO != null) {
    row.CONTRATO = String(row.CONTRATO).trim();
  }

  // Stringify remaining text fields
  for (const field of ['NOMBRE', 'USUARIO', 'DNI', 'SEGMENTO', 'JEFE', 'SUPERIOR', 'ESTADO', 'SITIO', 'MODALIDAD']) {
    if (row[field] != null) row[field] = String(row[field]).trim();
  }

  return row;
}

/**
 * Process CSV data and convert to Agent objects
 */
function processCsvData(rows: CsvRow[]): CsvParseResult {
  const agents: Agent[] = [];
  const errors: CsvParseResult['errors'] = [];
  const warnings: CsvParseResult['warnings'] = [];

  const leadersDetected = new Set<string>();
  const segmentsDetected = new Set<string>();

  rows.forEach((rawRow, index) => {
    const rowNum = index + 2; // 1-indexed, accounting for header
      const row = normalizeRow(rawRow) as Record<string, string>;

    try {
      // Validate required fields
      const requiredFields = ['NOMBRE', 'USUARIO', 'HORARIOS', 'CONTRATO'];
      const missingFields = requiredFields.filter((field) => !row[field]);

      if (missingFields.length > 0) {
        errors.push({
          row: rowNum,
          field: missingFields.join(', '),
          value: row,
          message: `Campos requeridos faltantes: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Parse contract
      const contractResult = parseContractHours(toTrimmedString(row.CONTRATO));
      if (contractResult.error) {
        errors.push({
          row: rowNum,
          field: 'CONTRATO',
          value: row.CONTRATO,
          message: contractResult.error,
        });
        return;
      }

      // Parse time range
      const timeResult = parseTimeRange(toTrimmedString(row.HORARIOS), contractResult.hours!);
      if (timeResult.error) {
        errors.push({
          row: rowNum,
          field: 'HORARIOS',
          value: row.HORARIOS,
          message: timeResult.error,
        });
        return;
      }

      // Detect leaders and segments
      const jefe = row.JEFE?.trim() || row.SUPERIOR?.trim() || 'Sin líder';
      const superior = row.SUPERIOR?.trim() || 'Sin superior';
      const segmento = row.SEGMENTO?.trim() || 'Sin segmento';

      leadersDetected.add(jefe);
      segmentsDetected.add(segmento);

      // Create agent
      const agent: Agent = {
        id: `agent-${row.DNI || rowNum}-${Date.now()}`,
        dni: row.DNI?.trim() || '',
        usuario: row.USUARIO.trim(),
        nombre: row.NOMBRE.trim(),
        superior,
        segmento,
        horarios: row.HORARIOS.trim(),
        estado: row.ESTADO?.trim() || 'ACTIVO',
        contrato: row.CONTRATO.trim(),
        sitio: row.SITIO?.trim() || '',
        modalidad: row.MODALIDAD?.trim() || '',
        jefe,

        // Parsed fields
        dailyHours: contractResult.hours!,
        entryTime: timeResult.entryTime,
        exitTime: timeResult.exitTime,
        shift: timeResult.shift,

        // Assignment
        assignmentStatus: 'unassigned',
        isLocked: false,

        // Metadata
        parseErrors: [],
      };

      // Add warnings for non-standard values
      if (!row.DNI) {
        warnings.push({
          row: rowNum,
          field: 'DNI',
          message: 'DNI faltante, se generó ID automático',
        });
      }

      if (!row.JEFE && !row.SUPERIOR) {
        warnings.push({
          row: rowNum,
          field: 'JEFE/SUPERIOR',
          message: 'No se detectó líder ni superior',
        });
      }

      agents.push(agent);
    } catch (error) {
      errors.push({
        row: rowNum,
        field: 'GENERAL',
        value: row,
        message: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  });

  const leaders = extractLeaders(agents);

  return {
    agents,
    leaders,
    errors,
    warnings,
    stats: {
      totalRows: rows.length,
      validAgents: agents.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      leadersDetected: leaders.length,
      segmentsDetected: segmentsDetected.size,
    },
  };
}

/**
 * Extract virtual leader objects from agents' SUPERIOR field.
 * Leaders have no CSV row of their own — they are derived from the unique
 * values in the SUPERIOR column.
 *
 * Schedule rules:
 *   entryTime = earliest entryTime among the leader's team members
 *   exitTime  = entryTime + 7 hours
 */
function extractLeaders(agents: Agent[]): Leader[] {
  const teamMap = new Map<string, Agent[]>();

  agents.forEach((agent) => {
    const leaderName = agent.superior?.trim();
    if (!leaderName || leaderName === 'Sin superior') return;

    const existing = Array.from(teamMap.keys()).find(
      (k) => k.toLowerCase() === leaderName.toLowerCase()
    );
    const key = existing ?? leaderName;
    if (!teamMap.has(key)) teamMap.set(key, []);
    teamMap.get(key)!.push(agent);
  });

  const leaders: Leader[] = [];

  teamMap.forEach((teamAgents, nombre) => {
    // Entry = earliest team member entry
    const entryMinutes = Math.min(...teamAgents.map((a) => timeToMinutes(a.entryTime)));
    const exitMinutes = entryMinutes + 7 * 60;

    const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
    const toHHmm = (mins: number) =>
      `${pad(mins / 60 % 24)}:${pad(mins % 60)}`;

    leaders.push({
      id: `leader-${nombre.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`,
      nombre,
      entryTime: toHHmm(entryMinutes),
      exitTime: toHHmm(exitMinutes),
      teamSize: teamAgents.length,
      boxId: undefined,
    });
  });

  // Sort: morning first (earlier entry), then by team size descending
  leaders.sort((a, b) => {
    const diff = timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime);
    if (diff !== 0) return diff;
    return b.teamSize - a.teamSize;
  });

  return leaders;
}

