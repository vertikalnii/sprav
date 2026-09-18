import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Employee, TrueConfUser, DiscrepancyReport, ProcessingStats } from './types';
import { matchEmployeesToTrueConf, generateTrueConfLink, generatePhoneCallLink, generateId } from './utils/matching';
import { parseEmployeeFile, parseTrueConfFile, exportToExcel } from './utils/excel';
import {
  saveState, loadState, saveFile, getAllFiles, deleteFile, clearAllFiles,
  addHistory, StoredFile, AppState
} from './utils/storage';
import { serializeProject, deserializeProject, downloadProjectFile, formatFileSize } from './utils/projectFile';
import FileUpload from './components/FileUpload';
import EmployeeTable from './components/EmployeeTable';
import Report from './components/Report';
import TrueConfView from './components/TrueConfView';
import ContainerPanel from './components/ContainerPanel';

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
  const [storedFiles, setStoredFiles] = useState<StoredFile[]>([]);
  const [containerOpen, setContainerOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  const employeesRef = useRef(employees);
  const trueConfUsersRef = useRef(trueConfUsers);
  employeesRef.current = employees;
  trueConfUsersRef.current = trueConfUsers;

  // === INITIALIZATION — load from container ===
  useEffect(() => {
    const init = async () => {
      try {
        const state = await loadState();
        const files = await getAllFiles();
        setStoredFiles(files);

        if (state && state.employees && state.employees.length > 0) {
          setEmployees(state.employees);
          setTrueConfUsers(state.trueConfUsers || []);
          setDiscrepancies(state.discrepancies || []);
          setStats(state.stats || { totalEmployees: 0, matched: 0, unmatched: 0, conflicts: 0, newEmployees: 0 });
          setRefFileName(state.refFileName || '');
          setTcFiles(state.tcFiles || []);
          setAutoSaveStatus('saved');
        }
      } catch (e) {
        console.error('Init error:', e);
      }
      setIsInitialized(true);
    };
    init();
  }, []);

  // === AUTO-SAVE ===
  const autoSaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    if (!isInitialized) return;
    
    setAutoSaveStatus('saving');
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    
    autoSaveTimeout.current = setTimeout(async () => {
      try {
        const state: AppState = {
          employees,
          trueConfUsers,
          discrepancies,
          stats,
          refFileName,
          tcFiles,
          lastUpdated: new Date().toISOString(),
          version: 1,
        };
        await saveState(state);
        setAutoSaveStatus('saved');
      } catch (e) {
        console.error('Auto-save error:', e);
        setAutoSaveStatus('idle');
      }
    }, 800);

    return () => {
      if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    };
  }, [employees, trueConfUsers, discrepancies, stats, refFileName, tcFiles, isInitialized]);

  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  }, []);

  const logHistory = useCallback(async (action: string, details: string) => {
    await addHistory({
      timestamp: new Date().toISOString(),
      action,
      details,
      snapshot: {
        employeeCount: employeesRef.current.length,
        matchedCount: employeesRef.current.filter(e => e.matchStatus === 'matched').length,
      },
    });
  }, []);

  const runMatchingFn = useCallback((emps: Employee[], tcUsers: TrueConfUser[]) => {
    const { results, discrepancies: discs, stats: st } = matchEmployeesToTrueConf(emps, tcUsers);
    const updatedEmployees = results.map(r => r.employee);
    setEmployees(updatedEmployees);
    setDiscrepancies(discs);
    setStats(st);
    showNotification('info', `Сопоставление: ${st.matched} найдено, ${st.unmatched} не найдено, ${st.conflicts} конфликтов`);
    logHistory('Сопоставление выполнено', `${st.matched} из ${st.totalEmployees} сотрудников найдены в TrueConf`);
  }, [showNotification, logHistory]);

  const handleRefFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const file = files[0];
      const parsed = await parseEmployeeFile(file);
      setEmployees(parsed);
      setRefFileName(file.name);

      // Save file to container
      const fileId = generateId();
      const arrayBuffer = await file.arrayBuffer();
      const storedFile: StoredFile = {
        id: fileId,
        name: file.name,
        type: 'reference',
        data: arrayBuffer,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        recordCount: parsed.length,
      };
      await saveFile(storedFile);
      setStoredFiles(prev => [...prev.filter(f => f.type !== 'reference'), storedFile]);

      showNotification('success', `Загружено ${parsed.length} сотрудников из "${file.name}"`);
      logHistory('Загрузка справочника', `Файл: ${file.name}, ${parsed.length} записей`);

      if (trueConfUsersRef.current.length > 0) {
        runMatchingFn(parsed, trueConfUsersRef.current);
      }
    } catch (error) {
      showNotification('error', `Ошибка загрузки: ${error}`);
    }
    setIsLoading(false);
  }, [showNotification, runMatchingFn, logHistory]);

  const handleTcFilesUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    setIsLoading(true);
    try {
      const allUsers: TrueConfUser[] = [];
      const fileNames: string[] = [];
      const newStoredFiles: StoredFile[] = [];

      for (const file of files) {
        const users = await parseTrueConfFile(file);
        allUsers.push(...users);
        fileNames.push(file.name);

        const arrayBuffer = await file.arrayBuffer();
        newStoredFiles.push({
          id: generateId(),
          name: file.name,
          type: 'trueconf',
          data: arrayBuffer,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          recordCount: users.length,
        });
      }

      setTrueConfUsers(allUsers);
      setTcFiles(prev => [...prev, ...fileNames]);

      for (const sf of newStoredFiles) {
        await saveFile(sf);
      }
      setStoredFiles(prev => [...prev, ...newStoredFiles]);

      showNotification('success', `Загружено ${allUsers.length} пользователей TC из ${files.length} файл(ов)`);
      logHistory('Загрузка TrueConf', `${files.length} файл(ов), ${allUsers.length} пользователей`);

      if (employeesRef.current.length > 0) {
        runMatchingFn(employeesRef.current, allUsers);
      }
    } catch (error) {
      showNotification('error', `Ошибка загрузки TC: ${error}`);
    }
    setIsLoading(false);
  }, [showNotification, runMatchingFn, logHistory]);

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
    showNotification('success', 'Справочник экспортирован в Excel');
    logHistory('Экспорт в Excel', `Экспортировано ${employees.length} записей`);
  }, [employees, showNotification, logHistory]);

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
    logHistory('Генерация ссылок', `Обновлены гиперссылки для ${updated.length} сотрудников`);
  }, [employees, showNotification, logHistory]);

  // === PROJECT SAVE/LOAD ===
  const handleSaveProject = useCallback(async () => {
    const state = {
      employees,
      trueConfUsers,
      discrepancies,
      stats,
      refFileName,
      tcFiles,
    };
    const json = serializeProject(state, storedFiles);
    const date = new Date().toISOString().slice(0, 10);
    downloadProjectFile(json, `Справочник_проект_${date}.spravochnik`);
    showNotification('success', 'Проект сохранён в файл');
    logHistory('Сохранение проекта', `Экспорт в .spravochnik`);
  }, [employees, trueConfUsers, discrepancies, stats, refFileName, tcFiles, storedFiles, showNotification, logHistory]);

  const handleLoadProject = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.spravochnik,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      setIsLoading(true);
      try {
        const text = await file.text();
        const { state, files } = deserializeProject(text);
        
        setEmployees(state.employees);
        setTrueConfUsers(state.trueConfUsers);
        setDiscrepancies(state.discrepancies);
        setStats(state.stats);
        setRefFileName(state.refFileName);
        setTcFiles(state.tcFiles);

        // Save files to container
        await clearAllFiles();
        for (const f of files) {
          await saveFile(f);
        }
        setStoredFiles(files);

        showNotification('success', `Проект загружен: ${state.employees.length} сотрудников`);
        logHistory('Загрузка проекта', `Импорт из файла: ${file.name}`);
      } catch (error) {
        showNotification('error', `Ошибка загрузки проекта: ${error}`);
      }
      setIsLoading(false);
    };
    input.click();
  }, [showNotification, logHistory]);

  // === CONTAINER ACTIONS ===
  const handleDeleteFile = useCallback(async (id: string) => {
    await deleteFile(id);
    setStoredFiles(prev => prev.filter(f => f.id !== id));
    showNotification('info', 'Файл удалён из контейнера');
    logHistory('Удаление файла', `Файл удалён из контейнера`);
  }, [showNotification, logHistory]);

  const handleClearAll = useCallback(() => {
    setEmployees([]);
    setTrueConfUsers([]);
    setDiscrepancies([]);
    setStats({ totalEmployees: 0, matched: 0, unmatched: 0, conflicts: 0, newEmployees: 0 });
    setRefFileName('');
    setTcFiles([]);
    setStoredFiles([]);
    showNotification('info', 'Контейнер очищен');
  }, [showNotification]);

  const hasData = employees.length > 0 || trueConfUsers.length > 0;

  const totalStorageSize = storedFiles.reduce((s, f) => s + f.size, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[60] px-5 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in ${
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
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">ПАО «СН-МНГ» • Контейнер</p>
                  {isInitialized && (
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${
                      autoSaveStatus === 'saved' ? 'bg-green-100 text-green-700' :
                      autoSaveStatus === 'saving' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        autoSaveStatus === 'saved' ? 'bg-green-500' :
                        autoSaveStatus === 'saving' ? 'bg-yellow-500 animate-pulse' :
                        'bg-gray-400'
                      }`}></span>
                      {autoSaveStatus === 'saved' ? 'сохранено' : autoSaveStatus === 'saving' ? 'сохранение...' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Container button */}
              <button
                onClick={() => setContainerOpen(true)}
                className="px-3 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors font-medium flex items-center gap-1.5 shadow-sm"
              >
                <span>📦</span>
                <span className="hidden sm:inline">Контейнер</span>
                {storedFiles.length > 0 && (
                  <span className="bg-white/20 px-1.5 py-0.5 rounded text-xs">{storedFiles.length}</span>
                )}
              </button>

              {hasData && (
                <>
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
                    📥 Excel
                  </button>
                </>
              )}

              {/* Project save/load */}
              <div className="flex items-center border-l border-gray-200 pl-2 ml-1">
                <button
                  onClick={handleSaveProject}
                  disabled={!hasData}
                  className="px-2 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Сохранить проект (.spravochnik)"
                >
                  💾
                </button>
                <button
                  onClick={handleLoadProject}
                  className="px-2 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                  title="Загрузить проект"
                >
                  📂
                </button>
              </div>
            </div>
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
            {/* Container Status Banner */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">📦</span>
                  <h2 className="text-xl font-bold">Изолированный контейнер</h2>
                  <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full border border-emerald-500/30">
                    ACTIVE
                  </span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed max-w-2xl">
                  Все данные хранятся внутри приложения в защищённом контейнере (IndexedDB).
                  Файлы, справочник, история — всё изолировано и автоматически сохраняется.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-emerald-400">📋</span>
                    <span className="text-sm">{employees.length} сотрудников</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-blue-400">📡</span>
                    <span className="text-sm">{trueConfUsers.length} пользователей TC</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-lg px-3 py-2 flex items-center gap-2">
                    <span className="text-purple-400">📁</span>
                    <span className="text-sm">{storedFiles.length} файлов ({formatFileSize(totalStorageSize)})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Upload sections */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                  <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  Справочник сотрудников
                </h3>
                <FileUpload
                  onFileSelect={handleRefFileUpload}
                  accept=".xlsx,.xls"
                  label="Загрузить справочник"
                  description="Файл будет сохранён в контейнер"
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
                  description="Несколько файлов → все в контейнер"
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

            {/* Project management */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">💾 Управление проектом</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={handleSaveProject}
                  disabled={!hasData}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="text-2xl mb-2">💾</div>
                  <p className="text-sm font-medium text-gray-700">Сохранить проект</p>
                  <p className="text-xs text-gray-500 mt-1">Экспорт .spravochnik</p>
                </button>
                <button
                  onClick={handleLoadProject}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-green-400 hover:bg-green-50 transition-all"
                >
                  <div className="text-2xl mb-2">📂</div>
                  <p className="text-sm font-medium text-gray-700">Загрузить проект</p>
                  <p className="text-xs text-gray-500 mt-1">Импорт .spravochnik</p>
                </button>
                <button
                  onClick={handleExport}
                  disabled={employees.length === 0}
                  className="p-4 border-2 border-dashed border-gray-300 rounded-xl text-center hover:border-emerald-400 hover:bg-emerald-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="text-2xl mb-2">📥</div>
                  <p className="text-sm font-medium text-gray-700">Экспорт в Excel</p>
                  <p className="text-xs text-gray-500 mt-1">Обновлённый справочник</p>
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-4">📖 Как работает контейнер</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">1</span>
                    <p><strong>Загрузка</strong> — файлы парсятся и сохраняются в контейнер (IndexedDB браузера)</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">2</span>
                    <p><strong>Автосохранение</strong> — все изменения сохраняются автоматически каждые 800мс</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-bold text-blue-700 shrink-0">3</span>
                    <p><strong>Изоляция</strong> — данные не покидают приложение, всё в одном месте</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">4</span>
                    <p><strong>Сохранение проекта</strong> — экспорт всего состояния в один файл .spravochnik</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">5</span>
                    <p><strong>Восстановление</strong> — загрузка проекта на любом компьютере</p>
                  </div>
                  <div className="flex gap-3">
                    <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">6</span>
                    <p><strong>История</strong> — все действия записываются в журнал контейнера</p>
                  </div>
                </div>
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

      {/* Container Panel */}
      <ContainerPanel
        isOpen={containerOpen}
        onClose={() => setContainerOpen(false)}
        files={storedFiles}
        onDeleteFile={handleDeleteFile}
        onClearAll={handleClearAll}
        employeeCount={employees.length}
        matchedCount={stats.matched}
      />

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-gray-400">
          <span>Справочник ПАО «СН-МНГ» • {new Date().getFullYear()}</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
            Контейнер активен
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
