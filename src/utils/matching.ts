import { Employee, TrueConfUser, MatchResult, DiscrepancyReport, ProcessingStats } from '../types';

// Target companies filter
const TARGET_COMPANIES = ['МЭН', 'МЕН', 'MEN', 'ПАО', 'PAO', 'СН-МНГ', 'SN-MNG', 'МУБР', 'MUBR'];

export function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ё/g, 'е')
    .trim();
}

export function normalizeCompany(company: string): string {
  if (!company) return '';
  return company.toUpperCase().trim();
}

export function isTargetCompany(company: string): boolean {
  const normalized = normalizeCompany(company);
  return TARGET_COMPANIES.some(target => normalized.includes(target));
}

export function matchEmployeesToTrueConf(
  employees: Employee[],
  trueConfUsers: TrueConfUser[]
): { results: MatchResult[]; discrepancies: DiscrepancyReport[]; stats: ProcessingStats } {
  const results: MatchResult[] = [];
  const discrepancies: DiscrepancyReport[] = [];
  const matchedTcUsers = new Set<string>();

  let matched = 0;
  let unmatched = 0;
  let conflicts = 0;

  for (const employee of employees) {
    const normalizedName = normalizeName(employee.fullName);
    
    // Find all TC users from target companies
    const targetUsers = trueConfUsers.filter(u => isTargetCompany(u.company));
    
    // Try exact match: name + company
    let exactMatches = targetUsers.filter(u => 
      normalizeName(u.fullName) === normalizedName && isTargetCompany(u.company)
    );
    
    if (exactMatches.length === 1) {
      results.push({
        employee: { ...employee, trueConfId: exactMatches[0].attribute, matchStatus: 'matched', matchedTrueConfUser: exactMatches[0] },
        trueConfUser: exactMatches[0],
        matchType: 'exact'
      });
      matchedTcUsers.add(exactMatches[0].attribute);
      matched++;
    } else if (exactMatches.length > 1) {
      // Multiple exact matches - conflict
      results.push({
        employee: { ...employee, matchStatus: 'conflict' },
        trueConfUser: null,
        matchType: 'multiple'
      });
      discrepancies.push({
        type: 'multiple_matches',
        name: employee.fullName,
        details: `Найдено ${exactMatches.length} совпадений в TrueConf`,
        company: exactMatches[0].company
      });
      conflicts++;
    } else {
      // Try name-only match
      let nameMatches = targetUsers.filter(u => 
        normalizeName(u.fullName) === normalizedName
      );
      
      if (nameMatches.length === 1) {
        results.push({
          employee: { ...employee, trueConfId: nameMatches[0].attribute, matchStatus: 'matched', matchedTrueConfUser: nameMatches[0] },
          trueConfUser: nameMatches[0],
          matchType: 'name_only'
        });
        matchedTcUsers.add(nameMatches[0].attribute);
        matched++;
      } else if (nameMatches.length > 1) {
        results.push({
          employee: { ...employee, matchStatus: 'conflict' },
          trueConfUser: null,
          matchType: 'multiple'
        });
        discrepancies.push({
          type: 'multiple_matches',
          name: employee.fullName,
          details: `Найдено ${nameMatches.length} совпадений по ФИО в TrueConf`,
        });
        conflicts++;
      } else {
        results.push({
          employee: { ...employee, matchStatus: 'unmatched' },
          trueConfUser: null,
          matchType: 'no_match'
        });
        discrepancies.push({
          type: 'in_ref_not_in_tc',
          name: employee.fullName,
          details: 'Сотрудник есть в справочнике, но нет в TrueConf',
          company: employee.position
        });
        unmatched++;
      }
    }
  }

  // Find TC users not in reference
  const targetUsers = trueConfUsers.filter(u => isTargetCompany(u.company));
  for (const tcUser of targetUsers) {
    if (!matchedTcUsers.has(tcUser.attribute)) {
      discrepancies.push({
        type: 'in_tc_not_in_ref',
        name: tcUser.fullName,
        details: `Пользователь TrueConf (${tcUser.login}) не найден в справочнике`,
        company: tcUser.company
      });
    }
  }

  const stats: ProcessingStats = {
    totalEmployees: employees.length,
    matched,
    unmatched,
    conflicts,
    newEmployees: 0
  };

  return { results, discrepancies, stats };
}

export function generateTrueConfLink(trueConfId: string): string {
  if (!trueConfId) return '';
  return `trueconf:${trueConfId}?do=profile`;
}

export function generatePhoneCallLink(phoneNumber: string): string {
  if (!phoneNumber) return '';
  const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
  return `Trueconf:#tel:${cleaned}`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// =============================================================================
// Автозаполнение ФИО и должности из выгрузок TrueConf (режим Администратора)
// Для записей справочника без ФИО/должности подбираем кандидата из TrueConf:
//  - по ID TrueConf (когда он уже известен), либо
//  - по логину/ФИО, если запись была добавлена как "новый пользователь TC".
// =============================================================================
export function autofillFromTrueConf(
  employees: Employee[],
  trueConfUsers: TrueConfUser[]
): { updated: Employee[]; filledCount: number } {
  let filledCount = 0;
  const byAttr = new Map<string, TrueConfUser>();
  for (const u of trueConfUsers) {
    if (u.attribute) byAttr.set(normalizeName(u.attribute), u);
    if (u.login) byAttr.set(normalizeName(u.login), u);
  }

  const updated = employees.map(emp => {
    const needName = !emp.fullName || !emp.fullName.trim();
    if (!needName) return emp;

    let user: TrueConfUser | undefined;
    if (emp.trueConfId) user = byAttr.get(normalizeName(emp.trueConfId));
    if (!user && emp.matchedTrueConfUser) user = emp.matchedTrueConfUser;

    if (user) {
      filledCount++;
      return {
        ...emp,
        fullName: user.fullName,
        position: emp.position || '', // должность в TrueConf отсутствует — заполняет администратор
        company: emp.company || user.company,
        matchStatus: 'matched' as const,
        matchedTrueConfUser: user,
      };
    }
    return emp;
  });

  return { updated, filledCount };
}

// =============================================================================
// Генерация ссылок вызова для экспорта в Excel (аналог формул HYPERLINK из VBA)
// =============================================================================
export function buildCallFormulaById(row: number): string {
  return `=IF(I${row}="","",HYPERLINK(CONCATENATE("trueconf:",I${row}),"Вызов по TrueConf"))`;
}

export function buildCallFormulaByPhone(row: number): string {
  return `=IF(J${row}=" ","",IFNA(HYPERLINK("Trueconf:#tel:"&J${row},"Позвонить на № телефона"),""))`;
}

export function buildPhoneCountFormula(row: number): string {
  return `=IF(D${row}=""," ",CONCATENATE("051",D${row}))`;
}

export function buildIdLookupFormula(row: number, sheet: string, range: string): string {
  return `=IF(A${row}="","",IFERROR(VLOOKUP(A${row},${sheet}!${range},2,0),""))`;
}
