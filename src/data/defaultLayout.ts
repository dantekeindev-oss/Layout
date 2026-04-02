import type { LayoutConfig } from '../types';

/**
 * Physical floor plan layout.
 * 91 assignable boxes (Box 1–91) + 7 LID label cells + aisles.
 *
 * Grid: 16 columns × 11 display rows
 *
 *  Row  1: [empty×4] Box91-82 | LID7          ← LID7 al lado de Box82
 *  Row  2: ──── PASILLO ────────────────
 *  Row  3: LID4 | Box69-74 | · | Box75-81 | LID6  ← LID6 al lado de Box81
 *  Row  4: ──── PASILLO ────────────────
 *  Row  5: LID5 | Box68-56 | LID3
 *  Row  6:  ·   | Box44-55
 *  Row  7: ──── PASILLO ────────────────
 *  Row  8: Box43-30 | LID2
 *  Row  9: Box16-29 | LID1
 *  Row 10: ──── PASILLO ────────────────
 *  Row 11: Box1-15
 */
export const defaultLayout: LayoutConfig = {
  id: 'default-layout',
  name: 'Layout Principal',
  rows: 11,
  columns: 16,
  cellWidth: 130,
  cellHeight: 110,
  aisleWidth: 24,

  zones: [
    { id: 'zone-lid1', name: 'LID 1', label: 'LID 1', color: '#dbeafe', boxIds: [] },
    { id: 'zone-lid2', name: 'LID 2', label: 'LID 2', color: '#d1fae5', boxIds: [] },
    { id: 'zone-lid3', name: 'LID 3', label: 'LID 3', color: '#fef3c7', boxIds: [] },
    { id: 'zone-lid4', name: 'LID 4', label: 'LID 4', color: '#fce7f3', boxIds: [] },
    { id: 'zone-lid5', name: 'LID 5', label: 'LID 5', color: '#ede9fe', boxIds: [] },
    { id: 'zone-lid6', name: 'LID 6', label: 'LID 6', color: '#ffedd5', boxIds: [] },
    { id: 'zone-lid7', name: 'LID 7', label: 'LID 7', color: '#e0f2fe', boxIds: [] },
  ],

  boxes: buildFloorPlan(),
};

function buildFloorPlan(): LayoutConfig['boxes'] {
  const cells: LayoutConfig['boxes'] = [];

  const CW = 80;
  const CH = 60;

  function addBox(numero: number, fila: number, columna: number, zona: string) {
    cells.push({
      id: `box-${numero}`,
      label: `${numero}`,
      numero,
      zona,
      fila,
      columna,
      bloque: zona,
      x: columna * 85,
      y: fila * 65,
      width: CW,
      height: CH,
      type: 'box' as const,
      activo: true,
      occupations: [],
      status: 'available' as const,
    });
  }

  function addLabel(id: string, label: string, fila: number, columna: number) {
    cells.push({
      id,
      label,
      numero: 0,
      zona: label, // LID belongs to its own zone (e.g. 'LID 1')
      fila,
      columna,
      bloque: label,
      x: columna * 85,
      y: fila * 65,
      width: CW,
      height: CH,
      type: 'lid' as const,
      activo: true,
      occupations: [],
      status: 'available' as const,
    });
  }

  /**
   * Aisle cells.
   * columna === 1  →  rendered as a full-width horizontal pasillo
   * columna > 1    →  rendered as a single vertical separator cell
   */
  function addAisle(id: string, fila: number, columna = 1) {
    cells.push({
      id,
      label: 'PASILLO',
      numero: 0,
      zona: '',
      fila,
      columna,
      bloque: '',
      x: columna * 85,
      y: fila * 65,
      width: CW,
      height: 20,
      type: 'aisle' as const,
      activo: false,
      occupations: [],
      status: 'available' as const,
    });
  }

  // ── Row 1: Box 91→82 at cols 5–14 | LID7 at col 16 ─────
  [91, 90, 89, 88, 87, 86, 85, 84, 83, 82].forEach((n, i) => addBox(n, 1, i + 5, 'LID 7'));
  addLabel('lid7', 'LID 7', 1, 16);  // líder de la zona superior derecha

  // ── Row 2: Horizontal PASILLO ────────────────────────────
  addAisle('aisle-2', 2);

  // ── Row 3: LID4 | Box 69–74 | separator | Box 75–81 | LID6
  addLabel('lid4', 'LID 4', 3, 1);
  for (let i = 0; i < 6; i++) addBox(69 + i, 3, i + 2, 'LID 4');
  addAisle('vpasillo-3', 3, 8);      // separador vertical entre LID4 y LID7
  for (let i = 0; i < 7; i++) addBox(75 + i, 3, i + 9, 'LID 7');
  addLabel('lid6', 'LID 6', 3, 16);  // líder de la zona media derecha

  // ── Row 4: Horizontal PASILLO ────────────────────────────
  addAisle('aisle-4', 4);

  // ── Row 5: LID5 | Box 68→56 | LID3 ─────────────────────
  addLabel('lid5', 'LID 5', 5, 1);
  [68, 67, 66, 65, 64, 63, 62, 61, 60, 59, 58, 57, 56].forEach((n, i) =>
    addBox(n, 5, i + 2, 'LID 5')
  );
  addLabel('lid3', 'LID 3', 5, 15);  // líder de la zona LID3 (abarca filas 5-6)

  // ── Row 6: Box 44→55 at cols 2–13  (zone LID 3) ─────────
  for (let i = 0; i < 12; i++) addBox(44 + i, 6, i + 2, 'LID 3');

  // ── Row 7: Horizontal PASILLO ────────────────────────────
  addAisle('aisle-7', 7);

  // ── Row 8: Box 43→30 at cols 1–14  | LID2 at col 15 ─────
  [43, 42, 41, 40, 39, 38, 37, 36, 35, 34, 33, 32, 31, 30].forEach((n, i) =>
    addBox(n, 8, i + 1, 'LID 2')
  );
  addLabel('lid2', 'LID 2', 8, 15);

  // ── Row 9: Box 16→29 at cols 1–14  | LID1 at col 15 ─────
  for (let i = 0; i < 14; i++) addBox(16 + i, 9, i + 1, 'LID 1');
  addLabel('lid1', 'LID 1', 9, 15);

  // ── Row 10: Horizontal PASILLO ───────────────────────────
  addAisle('aisle-10', 10);

  // ── Row 11: Box 1→15 at cols 1–15 ───────────────────────
  for (let i = 0; i < 15; i++) addBox(i + 1, 11, i + 1, 'LID 1');

  return cells;
}

export const layoutPresets = [
  { id: 'default', name: 'Plano Real (91 boxes)', layout: defaultLayout },
];
