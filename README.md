# Box Assignment - Sistema de Asignación de Boxes

Sistema web interactivo para asignar boxes físicos a agentes a partir de archivos CSV de nómina. Contempla horarios, duración de jornada, líderes, segmentos y reglas manuales de ubicación.

## Características

- **Carga de CSV**: Importa nóminas con validación de datos
- **Parsing inteligente**: Interpreta contratos (30hs, 35hs, 36hs) y horarios automáticamente
- **Asignación automática**: Motor de asignación con reglas y restricciones
- **Layout visual**: Vista interactiva tipo plano con boxes numerados
- **Gestión de reglas**: Configura reglas de fijación, cercanía, segmentos y zonas
- **Reutilización temporal**: Un box puede ser usado por diferentes agentes en distintos turnos
- **Exportación**: Genera reportes en Excel/CSV

## Tecnologías

- React 18 + TypeScript
- Vite
- Zustand (estado global)
- Tailwind CSS
- PapaParse (CSV)
- XLSX (exportación)
- dnd-kit (drag & drop)

## Instalación

```bash
cd Layout
npm install
```

## Desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

## Build

```bash
npm run build
```

## Formato del CSV

El archivo CSV debe contener las siguientes columnas:

| Columna | Descripción | Ejemplo |
|---------|-------------|---------|
| DNI | Documento | 12345678 |
| USUARIO | Usuario | jperez |
| NOMBRE | Nombre completo | Juan Pérez |
| SUPERIOR | Superior jerárquico | María Garcia |
| SEGMENTO | Segmento operativo | Ventas |
| HORARIOS | Horario de entrada | 06:00, 6 a 12, 14:00 |
| ESTADO | Estado del agente | ACTIVO |
| CONTRATO | Contrato semanal | 30hs, 35hs, 36hs |
| SITIO | Sede | Sede1 |
| MODALIDAD | Modalidad de trabajo | Presencial |
| JEFE | Líder directo | María Garcia |

### Formatos de horario soportados

- `06:00` - Solo hora de entrada
- `6:00` - Sin ceros
- `06 a 12` - Rango sin minutos
- `06:00 a 12:00` - Rango completo
- `14:00` - Hora simple

### Contratos y duración diaria

- **30hs o 36hs** → 6 horas diarias
- **35hs** → 7 horas diarias

## Estructura del Proyecto

```
src/
├── components/ui/      # Componentes UI reutilizables
├── features/
│   ├── csv/           # Carga y parsing de CSV
│   ├── layout/        # Vista visual del layout
│   ├── rules/         # Panel de reglas
│   └── table/         # Vista de tabla y exportación
├── lib/
│   ├── assignment/    # Motor de asignación
│   ├── parsers/       # CSV parser
│   └── utils/         # Utilidades
├── store/             # Zustand store
├── types/             # TypeScript types
└── data/              # Layouts predefinidos
```

## Uso

1. **Cargar CSV**: Sube el archivo de nómina
2. **Revisar validación**: Verifica errores y advertencias
3. **Ver layout**: Explora la asignación visual
4. **Configurar reglas**: Ajusta reglas de asignación si es necesario
5. **Exportar**: Descarga el resultado en Excel

## Reglas de Asignación

### Tipos de reglas

1. **Fijar líder**: Asigna un líder a un box específico
2. **Cerca del líder**: Intenta sentar al equipo cerca de su líder
3. **Mantener segmento junto**: Agrupa un segmento en la misma zona
4. **Restricción de zona**: Limita equipos/segmentos a zonas específicas
5. **Separar equipos**: Mantiene distancia mínima entre equipos
6. **Asignación manual**: Fija un agente a un box específico

## Vistas

- **Layout**: Vista visual interactiva del plano
- **Tabla**: Listado detallado de asignaciones
- **Reglas**: Configuración de reglas de asignación
- **Config**: Ajustes generales del sistema

## Persistencia

La configuración y reglas se guardan automáticamente en localStorage.

## Archivo de Ejemplo

Incluye `public/ejemplo_nominas.csv` como referencia de formato.

## License

MIT
