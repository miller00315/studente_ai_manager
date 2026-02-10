import * as XLSX from 'xlsx';
import { Address, UserRegistrationDTO } from '../types';

export interface StudentImportTemplateColumn {
  readonly key: string;
  readonly label: string;
  readonly required: boolean;
}

export interface StudentImportParseResult {
  readonly rawRows: ReadonlyArray<Record<string, unknown>>;
}

export interface StudentImportValidationError {
  readonly rowNumber: number;
  readonly field?: string;
  readonly message: string;
}

export interface StudentImportValidatedRow {
  readonly rowNumber: number;
  readonly student: UserRegistrationDTO;
  readonly address?: Partial<Address>;
}

export interface StudentImportValidationResult {
  readonly validRows: ReadonlyArray<StudentImportValidatedRow>;
  readonly errors: ReadonlyArray<StudentImportValidationError>;
}

const CSV_SEPARATOR: string = ',';

const REQUIRED_EMAIL_REGEX: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATE_COLUMNS: ReadonlyArray<StudentImportTemplateColumn> = [
  { key: 'first_name', label: 'first_name', required: true },
  { key: 'last_name', label: 'last_name', required: true },
  { key: 'email', label: 'email', required: true },
  { key: 'age', label: 'age', required: false },
  { key: 'grade_name', label: 'grade_name', required: true },
  { key: 'class_name', label: 'class_name', required: false },
  { key: 'birthdate', label: 'birthdate', required: false },
  { key: 'gender', label: 'gender', required: false },
  { key: 'address_line_1', label: 'address_line_1', required: false },
  { key: 'city', label: 'city', required: false },
  { key: 'state_province', label: 'state_province', required: false },
  { key: 'postal_code', label: 'postal_code', required: false },
  { key: 'country', label: 'country', required: false }
];

export const getStudentImportTemplateColumns = (): ReadonlyArray<StudentImportTemplateColumn> => TEMPLATE_COLUMNS;

export const buildStudentImportTemplateCsv = (): string => {
  const headers: string = TEMPLATE_COLUMNS.map((c: StudentImportTemplateColumn) => c.label).join(CSV_SEPARATOR);
  const exampleRow: string = [
    'Maria',
    'Silva',
    'maria.silva@example.com',
    '16',
    '6º Ano',
    'Turma A',
    '2010-02-15',
    'Female',
    'Rua Exemplo, 123',
    'São Paulo',
    'SP',
    '01000-000',
    'BR'
  ].join(CSV_SEPARATOR);
  return `${headers}\n${exampleRow}\n`;
};

export const buildStudentImportTemplateXlsx = (): Uint8Array => {
  const headers: string[] = TEMPLATE_COLUMNS.map((c: StudentImportTemplateColumn) => c.label);
  const exampleRow: (string | number)[] = [
    'Maria',
    'Silva',
    'maria.silva@example.com',
    16,
    '6º Ano',
    'Turma A',
    '2010-02-15',
    'Female',
    'Rua Exemplo, 123',
    'São Paulo',
    'SP',
    '01000-000',
    'BR'
  ];
  const sheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'students');
  const arrayBuffer: ArrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  return new Uint8Array(arrayBuffer);
};

export const parseStudentImportFile = async (file: File): Promise<StudentImportParseResult> => {
  const extension: string = (file.name.split('.').pop() || '').toLowerCase().trim();
  const arrayBuffer: ArrayBuffer = await file.arrayBuffer();

  if (extension === 'csv') {
    const text: string = new TextDecoder('utf-8').decode(arrayBuffer);
    const workbook = XLSX.read(text, { type: 'string' });
    const firstSheetName: string | undefined = workbook.SheetNames[0];
    if (!firstSheetName) return { rawRows: [] };
    const sheet = workbook.Sheets[firstSheetName];
    const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    return { rawRows: json.map(normalizeRecordKeys) };
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const workbook = XLSX.read(arrayBuffer);
    const firstSheetName: string | undefined = workbook.SheetNames[0];
    if (!firstSheetName) return { rawRows: [] };
    const sheet = workbook.Sheets[firstSheetName];
    const json: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    return { rawRows: json.map(normalizeRecordKeys) };
  }

  throw new Error(`Unsupported file type: ${extension}`);
};

export interface StudentImportResolutionContext {
  readonly institutionId: string;
  readonly gradeNameToId: ReadonlyMap<string, string>;
  readonly classNameToId: ReadonlyMap<string, string>;
}

export const validateStudentImportRows = (
  rawRows: ReadonlyArray<Record<string, unknown>>,
  context: StudentImportResolutionContext
): StudentImportValidationResult => {
  const validRows: StudentImportValidatedRow[] = [];
  const errors: StudentImportValidationError[] = [];

  rawRows.forEach((raw: Record<string, unknown>, index: number) => {
    const rowNumber: number = index + 2; // header is row 1 in spreadsheets
    const firstName: string = readString(raw, 'first_name');
    const lastName: string = readString(raw, 'last_name');
    const email: string = readString(raw, 'email').toLowerCase();
    const gradeId: string | undefined = resolveGradeId(raw, context.gradeNameToId);
    const classId: string | undefined = resolveClassId(raw, context.classNameToId);
    const age: number | undefined = parseOptionalNumber(readUnknown(raw, 'age'));
    const birthdate: string | undefined = parseOptionalDate(readUnknown(raw, 'birthdate'));
    const gender: string | undefined = parseOptionalGender(readString(raw, 'gender'));

    if (!firstName) errors.push({ rowNumber, field: 'first_name', message: 'first_name is required' });
    if (!lastName) errors.push({ rowNumber, field: 'last_name', message: 'last_name is required' });
    if (!email) errors.push({ rowNumber, field: 'email', message: 'email is required' });
    if (email && !REQUIRED_EMAIL_REGEX.test(email)) errors.push({ rowNumber, field: 'email', message: 'email is invalid' });
    if (!gradeId) errors.push({ rowNumber, field: 'grade_name', message: 'grade_name/grade_id is required and must match an existing grade' });
    if (age !== undefined && (age < 1 || age > 120)) errors.push({ rowNumber, field: 'age', message: 'age must be between 1 and 120' });

    const hasRowErrors: boolean = errors.some((e: StudentImportValidationError) => e.rowNumber === rowNumber);
    if (hasRowErrors) return;

    const address: Partial<Address> = buildOptionalAddress(raw);
    const student: UserRegistrationDTO = {
      email,
      first_name: firstName,
      last_name: lastName,
      institution_id: context.institutionId,
      grade_id: gradeId,
      class_id: classId || '',
      age: age,
      birthdate: birthdate,
      gender: gender
    };

    validRows.push({
      rowNumber,
      student,
      address: Object.keys(address).length > 0 ? address : undefined
    });
  });

  return { validRows, errors };
};

const normalizeRecordKeys = (raw: Record<string, unknown>): Record<string, unknown> => {
  const normalized: Record<string, unknown> = {};
  Object.entries(raw).forEach(([key, value]) => {
    const normalizedKey: string = normalizeHeaderKey(key);
    const mappedKey: string = mapHeaderAlias(normalizedKey);
    normalized[mappedKey] = value;
  });
  return normalized;
};

const normalizeHeaderKey = (input: string): string => input
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, '_')
  .replace(/[^a-z0-9_]/g, '');

const mapHeaderAlias = (key: string): string => {
  const aliases: Record<string, string> = {
    nome: 'first_name',
    primeiro_nome: 'first_name',
    firstname: 'first_name',
    first: 'first_name',
    sobrenome: 'last_name',
    ultimo_nome: 'last_name',
    lastname: 'last_name',
    last: 'last_name',
    email_address: 'email',
    serie: 'grade_name',
    grade: 'grade_name',
    turma: 'class_name',
    classe: 'class_name',
    sexo: 'gender',
    data_nascimento: 'birthdate',
    nascimento: 'birthdate',
    endereco: 'address_line_1',
    endereco1: 'address_line_1',
    cidade: 'city',
    estado: 'state_province',
    uf: 'state_province',
    cep: 'postal_code',
    pais: 'country'
  };
  return aliases[key] || key;
};

const readUnknown = (raw: Record<string, unknown>, key: string): unknown => raw[key];

const readString = (raw: Record<string, unknown>, key: string): string => {
  const value: unknown = raw[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const resolveGradeId = (raw: Record<string, unknown>, gradeNameToId: ReadonlyMap<string, string>): string | undefined => {
  const gradeId: string = readString(raw, 'grade_id');
  if (gradeId) return gradeId;
  const gradeName: string = readString(raw, 'grade_name');
  if (!gradeName) return undefined;
  const normalized: string = normalizeHeaderKey(gradeName);
  return gradeNameToId.get(normalized);
};

const resolveClassId = (raw: Record<string, unknown>, classNameToId: ReadonlyMap<string, string>): string | undefined => {
  const classId: string = readString(raw, 'class_id');
  if (classId) return classId;
  const className: string = readString(raw, 'class_name');
  if (!className) return undefined;
  const normalized: string = normalizeHeaderKey(className);
  return classNameToId.get(normalized);
};

const parseOptionalNumber = (value: unknown): number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const asString: string = String(value).trim();
  if (!asString) return undefined;
  const parsed: number = Number(asString.replace(',', '.'));
  if (!Number.isFinite(parsed)) return undefined;
  return Math.trunc(parsed);
};

const parseOptionalDate = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date: Date = XLSX.SSF.parse_date_code(value)
      ? new Date(Date.UTC(XLSX.SSF.parse_date_code(value)!.y, XLSX.SSF.parse_date_code(value)!.m - 1, XLSX.SSF.parse_date_code(value)!.d))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }
  const asString: string = String(value).trim();
  if (!asString) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(asString)) return asString;
  const match: RegExpMatchArray | null = asString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const day: number = Number(match[1]);
    const month: number = Number(match[2]);
    const year: number = Number(match[3]);
    const date: Date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10);
  }
  return undefined;
};

const parseOptionalGender = (value: string): string | undefined => {
  const normalized: string = value.trim().toLowerCase();
  if (!normalized) return undefined;
  const map: Record<string, string> = {
    male: 'Male',
    masculino: 'Male',
    m: 'Male',
    female: 'Female',
    feminino: 'Female',
    f: 'Female',
    other: 'Other',
    outro: 'Other',
    o: 'Other'
  };
  return map[normalized] || undefined;
};

const buildOptionalAddress = (raw: Record<string, unknown>): Partial<Address> => {
  const addressLine1: string = readString(raw, 'address_line_1');
  const city: string = readString(raw, 'city');
  const stateProvince: string = readString(raw, 'state_province');
  const postalCode: string = readString(raw, 'postal_code');
  const country: string = readString(raw, 'country');
  const address: Partial<Address> = {};
  if (addressLine1) address.address_line_1 = addressLine1;
  if (city) address.city = city;
  if (stateProvince) address.state_province = stateProvince;
  if (postalCode) address.postal_code = postalCode;
  if (country) address.country = country;
  return address;
};
