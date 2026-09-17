import React, { useState, useCallback, useRef } from 'react';
import { Employee, TrueConfUser, DiscrepancyReport, ProcessingStats } from './types';
import { matchEmployeesToTrueConf, generateTrueConfLink, generatePhoneCallLink } from './utils/matching';
import { parseEmployeeFile, parseTrueConfFile, exportToExcel } from './utils/excel';
import FileUpload from './components/FileUpload';
import EmployeeTable from './components/EmployeeTable';
import Report from './components/Report';
import TrueConfView from './components/TrueConfView';

type TabType = 'upload' | 'table' | 'tcview' | 'report';

function App() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [trueConfUsers, setTrueConfUsers] = useState<TrueConfUser[]>([]);
  const [tcFiles, setTcFiles] = useState<string[]>([]);
  const [refFileName, setRefFileName] = useState<string>('');
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyReport[]>([]);
  const [stats, setStats] = useState<ProcessingStats>({ totalEmployees: 0, matched: 0, unmatched: 0, conflicts: 0, newEmployees: 0 });
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Use refs to avoid stale closures in callbacks
  const employeesRef = useRef(employees);
  const trueConfUsersRef = useRef(trueConfUsers);
  employeesRef.current = employees;
  trueConfUsersRef.current = trueConfUsers;

  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const runMatchingFn = useCallback((emps: Employee[], tcUsers: TrueConfUser[]) => {
    const { results, discrepancies: discs, stats: st } = matchEmployeesToTrueConf(emps, tcUsers);
    const updatedEmployees = results.map(r => r.employee);
    setEmployees(updatedEmployees);
    setDiscrepancies(discs);
    setStats(st);
    showNotification('info', `Сопоставление: ${st.matched} найдено, ${st.unmatched} не найдено, ${st.conflicts} конфликтов`);
  }, [showNotification]);

  const handleRefFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const file = files[0];
      const parsed = await parseEmployeeFile(file);
      setEmployees(parsed);
      setRefFileName(file.name);
      showNotification('success', `Загружено ${parsed.length} сотрудников из "${file.name}"`);
      
      if (trueConfUsersRef.current.length > 0) {
        runMatchingFn(parsed, trueConfUsersRef.current);
      }
    } catch (error) {
      showNotification('error', `Ошибка загрузки: ${error}`);
    }
    setIsLoading(false);
  }, [showNotification, runMatchingFn]);

  const handleTcFilesUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const allUsers: TrueConfUser[] = [];
      const fileNames: string[] = [];
      
      for (const file of files) {
        const users = await parseTrueConfFile(file);
        allUsers.push(...users);
        fileNames.push(file.name);
      }
      
      setTrueConfUsers(allUsers);
      setTcFiles(prev => [...prev, ...fileNames]);
      showNotification('success', `Загружено ${allUsers.length} пользователей TC из ${files.length} файл(ов)`);
      
      if (employeesRef.current.length > 0) {
        runMatchingFn(employeesRef.current, allUsers);
      }
    } catch (error) {
      showNotification('error', `Ошибка загрузки TC: ${error}`);
    }
    setIsLoading(false);
  }, [showNotification, runMatchingFn]);

  const handleRunMatching = useCallback(() => {
    if (employees.length === 0 || trueConfUsers.length === 0) {
      showNotification('error', 'Загрузите справочник и файлы TrueConf');
      return;
    }
    runMatchingFn(employees, trueConfUsers);
    setActiveTab('table');
  }, [employees, trueConfUsers, showNotification, runMatchingFn]);

  const handleExport = useCallback(() => {
    if (employees.length === 0) {
      showNotification('error', 'Нет данных для экспорта');
      return;
    }
    exportToExcel(employees);
    showNotification('success', 'Справочник экспортирован');
  }, [employees, showNotification]);

  const handleUpdateEmployees = useCallback((updated: Employee[]) => {
    setEmployees(updated);
  }, []);

  const handleGenerateLinks = useCallback(() => {
    const updated = employees.map(emp => ({
      ...emp,
      trueConfCallLink: emp.trueConfId ? generateTrueConfLink(emp.trueConfId) : emp.trueConfCallLink,
      phoneCallLink: (emp.phoneNumber || emp.mobilePhone) ? generatePhoneCallLink(emp.phoneNumber || emp.mobilePhone) : emp.phoneCallLink,
    }));
    setEmployees(updated);
    showNotification('success', 'Гиперссылки сгенерированы');
  }, [employees, showNotification]);

  const hasData = employees.length > 0 || trueConfUsers.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-lg">
                С
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-800">Справочник сотрудников</h1>
                <p className="text-xs text-gray-500">ПАО «СН-МНГ» • Управление TrueConf</p>
              </div>
            </div>
            
            {hasData && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleGenerateLinks}
                  className="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                >
                  🔗 Ссылки
                </button>
                <button
                  onClick={handleRunMatching}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                >
                  🔄 Сопоставить
                </button>
                <button
                  onClick={handleExport}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium shadow-sm"
                >
                  📥 Экспорт
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      {hasData && (
        <nav className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'upload' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📁 Файлы
              </button>
              <button
                onClick={() => setActiveTab('table')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'table' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Справочник ({employees.length})
              </button>
              {trueConfUsers.length > 0 && (
                <button
                  onClick={() => setActiveTab('tcview')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === 'tcview' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  📡 TrueConf ({trueConfUsers.length})
                </button>
              )}
              <button
                onClick={() => setActiveTab('report')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'report' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📊 Отчёт {discrepancies.length > 0 && `(${discrepancies.length})`}
              </button>
            </div>
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600 font-medium">Загрузка данных...</p>
            </div>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl">
              <h2 className="text-xl font-bold mb-2">👋 Добро пожаловать!</h2>
              <p className="text-blue-100 text-sm leading-relaxed max-w-2xl">
                Загрузите справочник сотрудников (.xlsx) и файлы выгрузки TrueConf для автоматического сопоставления.
                Приложение нормализует ФИО, сопоставит данные по ФИО и компании, создаст гиперссылки для звонков.
              </p>
              {hasData && (
                <div className="mt-4 flex gap-4 text-sm">
                  <span className="bg-white/20 px-3 py-1 rounded-full">📋 {employees.length} сотрудников</span>
                  <span className="bg-white/20 px-3 py-1 rounded-full">📡 {trueConfUsers.length} пользователей TC</span>
                  {stats.matched > 0 && (
                    <span className="bg-white/20 px-3 py-1 rounded-full">✓ {stats.matched} сопоставлено</span>
                  )}
                </div>
              )}
            </div>

            {/* Upload sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Reference file */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Справочник сотрудников
                </h3>
                <FileUpload
                  onFileSelect={handleRefFileUpload}
                  accept=".xlsx,.xls"
                  label="Загрузить справочник"
                  description="Основной файл .xlsx с данными сотрудников"
                  icon="📋"
                />
                {refFileName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    <span>✅</span>
                    <span className="font-medium truncate">{refFileName}</span>
                    <span className="text-green-500 whitespace-nowrap">({employees.length})</span>
                  </div>
                )}
              </div>

              {/* TrueConf files */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-7 h-7 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  Файлы выгрузки TrueConf
                </h3>
                <FileUpload
                  onFileSelect={handleTcFilesUpload}
                  accept=".xlsx,.xls"
                  multiple
                  label="Загрузить выгрузки TrueConf"
                  description="Можно выбрать несколько файлов одновременно"
                  icon="📡"
                />
                {tcFiles.length > 0 && (
                  <div className="space-y-1">
                    {tcFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        <span>✅</span>
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500 mt-1">
                      Всего пользователей TC: {trueConfUsers.length}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action button */}
            {employees.length > 0 && trueConfUsers.length > 0 && (
              <div className="flex justify-center">
                <button
                  onClick={handleRunMatching}
                  className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl text-lg font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                >
                  🚀 Запустить сопоставление
                </button>
              </div>
            )}

            {/* Instructions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">📖 Инструкция по форматам файлов</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                <div className="space-y-2">
                  <p className="font-medium text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 bg-blue-100 rounded text-blue-600 flex items-center justify-center text-xs">📋</span>
                    Формат справочника (колонки):
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs">
                    <li>Фамилия Имя Отчество</li>
                    <li>Должность</li>
                    <li>№ Кабинета</li>
                    <li>№ Телефона</li>
                    <li>№ Корпоративный мобильный</li>
                    <li>Тип телефонной линии</li>
                    <li>Звонок в TrueConf</li>
                    <li>Звонок на № телефона</li>
                    <li>ID TrueConf</li>
                    <li>#телефона</li>
                  </ol>
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-gray-700 flex items-center gap-2">
                    <span className="w-5 h-5 bg-indigo-100 rounded text-indigo-600 flex items-center justify-center text-xs">📡</span>
                    Формат файлов TrueConf (колонки):
                  </p>
                  <ol className="list-decimal list-inside space-y-0.5 text-xs">
                    <li>Логин</li>
                    <li>ФИО</li>
                    <li>Регион</li>
                    <li>Сервер</li>
                    <li>Атрибут (ID TrueConf)</li>
                    <li>Компания</li>
                    <li>Email</li>
                    <li>Дата предоставления доступа</li>
                    <li>Дата первого входа</li>
                  </ol>
                </div>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  <strong className="text-gray-700">Логика сопоставления:</strong> Сначала ищется точное совпадение ФИО + Компания (целевые: МЭН, ПАО СН-МНГ, МУБР). 
                  Если не найдено — поиск только по ФИО. ФИО нормализуются: нижний регистр, удаление двойных пробелов, замена «ё» на «е».
                </p>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-500">
                  <strong className="text-gray-700">Формулы гиперссылок:</strong><br/>
                  • Звонок в TC: <code className="bg-gray-100 px-1 rounded text-xs">trueconf:{"{ID}"}?do=profile</code><br/>
                  • Звонок на телефон: <code className="bg-gray-100 px-1 rounded text-xs">Trueconf:#tel:{"{номер}"}</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'table' && (
          <EmployeeTable employees={employees} onUpdate={handleUpdateEmployees} />
        )}

        {activeTab === 'tcview' && (
          <TrueConfView users={trueConfUsers} files={tcFiles} />
        )}

        {activeTab === 'report' && (
          <Report discrepancies={discrepancies} stats={stats} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          Справочник сотрудников ПАО «СН-МНГ» • Управление TrueConf • {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

export default App;
