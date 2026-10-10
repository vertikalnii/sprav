export interface Employee {
  id: string;
  fullName: string;
  position: string;
  officeNumber: string;
  phoneNumber: string;
  mobilePhone: string;
  lineType: string;
  trueConfCallLink: string;
  phoneCallLink: string;
  trueConfId: string;
  phoneCount: string;
  company?: string;   // Компания (МЭН / ПАО СН-МНГ / МУБР) — из справочника или сопоставления
  department?: string; // Подразделение / заголовок раздела (для отчёта по категориям)
  // Matching status
  matchStatus?: 'matched' | 'unmatched' | 'conflict' | 'new';
  matchedTrueConfUser?: TrueConfUser;
}

export interface TrueConfUser {
  login: string;
  fullName: string;
  region: string;
  server: string;
  attribute: string; // ID TrueConf
  company: string;
  email: string;
  accessDate: string;
  firstLoginDate: string;
  sourceFile: string;
}

export interface MatchResult {
  employee: Employee;
  trueConfUser: TrueConfUser | null;
  matchType: 'exact' | 'name_only' | 'no_match' | 'multiple';
}

export interface ProcessingStats {
  totalEmployees: number;
  matched: number;
  unmatched: number;
  conflicts: number;
  newEmployees: number;
}

export interface DiscrepancyReport {
  type: 'in_tc_not_in_ref' | 'in_ref_not_in_tc' | 'multiple_matches';
  name: string;
  details: string;
  company?: string;
}
