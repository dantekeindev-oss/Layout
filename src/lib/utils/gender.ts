/**
 * Common Spanish/Argentine female first names for gender detection.
 * Stored normalized (lowercase, no accents) for resilient matching.
 */
const FEMALE = new Set([
  'ana', 'maria', 'laura', 'sofia', 'isabel', 'carmen', 'lucia', 'rosa',
  'andrea', 'daniela', 'valentina', 'martina', 'paula', 'natalia', 'elena',
  'sara', 'patricia', 'silvia', 'claudia', 'alejandra', 'fernanda', 'gabriela',
  'diana', 'vanesa', 'vanessa', 'adriana', 'rocio', 'beatriz', 'veronica',
  'miriam', 'noemi', 'raquel', 'sandra', 'susana', 'marta', 'julia',
  'victoria', 'irene', 'rebeca', 'monica', 'lorena', 'yolanda', 'virginia',
  'cristina', 'alicia', 'pilar', 'dolores', 'concepcion', 'amparo', 'lourdes',
  'esther', 'josefa', 'manuela', 'encarnacion', 'mercedes', 'francisca',
  'esperanza', 'nuria', 'margarita', 'inmaculada', 'gloria', 'olga',
  'eva', 'emma', 'alba', 'clara', 'carla', 'nerea', 'leire', 'amaia',
  'aitana', 'mar', 'luz', 'sol', 'flor', 'celia', 'vera', 'lia', 'lía',
  'valeria', 'camila', 'renata', 'agustina', 'florencia', 'constanza',
  'xiomara', 'yesica', 'jessica', 'brenda', 'celeste', 'romina', 'sabrina',
  'soledad', 'silvana', 'graciela', 'marcela', 'nadia', 'paola', 'viviana',
  'liliana', 'estela', 'rita', 'ruth', 'norma', 'zulma', 'myriam', 'gladys',
  'elsa', 'mariana', 'carolina', 'cecilia', 'gisela', 'betina', 'carina',
  'vanina', 'karina', 'melisa', 'noelia', 'micaela', 'magali', 'morena',
  'priscila', 'daiana', 'luciana', 'marina', 'trinidad', 'fabiola',
  'griselda', 'roxana', 'yanina', 'yamila', 'giselle', 'ailen', 'ayelen',
  'ailén', 'ayelén', 'cintia', 'cindy', 'wendy', 'briana', 'johanna',
  'wanda', 'carola', 'vicky', 'nati', 'fani', 'fanny', 'belen', 'belén',
  'emilia', 'catalina', 'antonia', 'josefina', 'isadora', 'malena',
  'piedad', 'mercedes', 'rosario', 'dolores', 'amparo',
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Returns true if the full name is likely female based on the first token. */
export function isFemale(fullName: string): boolean {
  const first = fullName.trim().split(/\s+/)[0];
  return FEMALE.has(normalize(first));
}
