import * as XLSX from 'xlsx';
import { Employee, TrueConfUser } from '../types';
import { generateId } from './matching';

export function parseEmployeeFile(file: File): Promise<Employee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        
        // Skip header row
        const employees: Employee[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0]) continue;
          
          employees.push({
            id: generateId(),
            fullName: String(row[0] || '').trim(),
            position: String(row[1] || '').trim(),
            officeNumber: String(row[2] || '').trim(),
            phoneNumber: String(row[3] || '').trim(),
            mobilePhone: String(row[4] || '').trim(),
            lineType: String(row[5] || '').trim(),
            trueConfCallLink: String(row[6] || '').trim(),
            phoneCallLink: String(row[7] || '').trim(),
            trueConfId: String(row[8] || '').trim(),
            phoneCount: String(row[9] || '').trim(),
          });
        }
        resolve(employees);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function parseTrueConfFile(file: File): Promise<TrueConfUser[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        
        const users: TrueConfUser[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || !row[0]) continue;
          
          users.push({
            login: String(row[0] || '').trim(),
            fullName: String(row[1] || '').trim(),
            region: String(row[2] || '').trim(),
            server: String(row[3] || '').trim(),
            attribute: String(row[4] || '').trim(),
            company: String(row[5] || '').trim(),
            email: String(row[6] || '').trim(),
            accessDate: String(row[7] || '').trim(),
            firstLoginDate: String(row[8] || '').trim(),
            sourceFile: file.name,
          });
        }
        resolve(users);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export function exportToExcel(employees: Employee[], filename: string = 'Справочник_обновленный.xlsx') {
  const header = [
    'Фамилия Имя Отчество',
    'Должность',
    '№ Кабинета',
    '№ Телефона',
    '№ Корпоративный мобильный телефон',
    'Тип телефонной линии',
    'Звонок в TrueConf',
    'Звонок на № телефона с TrueConf',
    'ID TrueConf',
    '#телефона'
  ];

  const data = employees.map(emp => [
    emp.fullName,
    emp.position,
    emp.officeNumber,
    emp.phoneNumber,
    emp.mobilePhone,
    emp.lineType,
    emp.trueConfCallLink,
    emp.phoneCallLink,
    emp.trueConfId,
    emp.phoneCount
  ]);

  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 35 }, // ФИО
    { wch: 30 }, // Должность
    { wch: 12 }, // Кабинет
    { wch: 18 }, // Телефон
    { wch: 20 }, // Мобильный
    { wch: 15 }, // Тип линии
    { wch: 40 }, // Звонок TC
    { wch: 35 }, // Звонок на телефон
    { wch: 20 }, // ID TC
    { wch: 10 },  // #телефона
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Справочник');
  XLSX.writeFile(wb, filename);
}

// =============================================================================
// Экспорт с «живыми» формулами HYPERLINK/VLOOKUP — как в исходном Excel-файле.
// Колонки: A..J (10 колонок). Формулы в G (звонок по ID), H (звонок по номеру),
// J (#телефона) пересчитываются Excel при открытии и работают в LibreOffice.
// =============================================================================
export function exportToExcelWithFormulas(
  employees: Employee[],
  filename: string = 'СПРАВОЧНИК СН-МНГ.xlsx'
) {
  const header = [
    'Фамилия Имя Отчество',
    'Должность',
    '№ Кабинета',
    '№ Телефона',
    '№ Корпоративный мобильный телефон',
    'Тип телефонной линии',
    'Звонок в TrueConf',
    'Звонок на № телефона с TrueConf',
    'ID TrueConf',
    '#телефона',
  ];

  const aoa: any[][] = [header];
  employees.forEach((emp, idx) => {
    const r = idx + 2; // строка в листе (после заголовка)
    aoa.push([
      emp.fullName,
      emp.position,
      emp.officeNumber,
      emp.phoneNumber,
      emp.mobilePhone,
      emp.lineType,
      { t: 's', f: `IF(I${r}="","",HYPERLINK(CONCATENATE("trueconf:",I${r}),"Вызов по TrueConf"))` },
      { t: 's', f: `IF(J${r}=" ","",IFERROR(HYPERLINK("Trueconf:#tel:"&J${r},"Позвонить на № телефона"),""))` },
      emp.trueConfId,
      { t: 's', f: `IF(D${r}=""," ",CONCATENATE("051",D${r}))` },
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 35 }, { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 20 },
    { wch: 15 }, { wch: 40 }, { wch: 35 }, { wch: 20 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Справочник');
  XLSX.writeFile(wb, filename);
}

export function exportReportToExcel(report: Array<{type: string; name: string; details: string; company?: string}>, filename: string = 'Отчет_расхождения.xlsx') {
  const header = ['Тип', 'ФИО', 'Детали', 'Компания'];
  const typeLabels: Record<string, string> = {
    'in_tc_not_in_ref': 'В TrueConf, нет в справочнике',
    'in_ref_not_in_tc': 'В справочнике, нет в TrueConf',
    'multiple_matches': 'Множественные совпадения'
  };
  
  const data = report.map(r => [
    typeLabels[r.type] || r.type,
    r.name,
    r.details,
    r.company || ''
  ]);

  const wsData = [header, ...data];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 50 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Расхождения');
  XLSX.writeFile(wb, filename);
}
